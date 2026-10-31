"""Exercise missing-component installs and failures without network or host writes."""

import os
from pathlib import Path
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]


class HerdrInstallTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="workstation-herdr-test-")
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.home = self.base / "home"
        self.bin = self.home / ".local/bin"
        self.bin.mkdir(parents=True)
        self.fixtures = self.base / "fixtures"
        self.fixtures.mkdir()
        self.log = self.base / "downloads"
        mocks = self.base / "mocks"
        mocks.mkdir()
        self.write_executable(mocks / "curl", '''#!/usr/bin/python3
import os
from pathlib import Path
import shutil
import sys

url = next(arg for arg in sys.argv if arg.startswith("https://"))
component = url.removeprefix("https://releases.herdr.dev/").removesuffix("/install.sh")
assert component in ("core", "app"), url
destination = Path(sys.argv[sys.argv.index("--output") + 1])
with open(os.environ["HERDR_TEST_LOG"], "a") as log:
    log.write(component + "\\n")
if os.environ.get("HERDR_TEST_FAIL") == component:
    destination.write_text('touch "$HOME/partial-installer-ran"\\n')
    sys.exit(22)
shutil.copyfile(Path(os.environ["HERDR_TEST_FIXTURES"]) / (component + ".sh"), destination)
''')
        (self.fixtures / "core.sh").write_text('''#!/bin/sh
set -eu
mkdir -p "$HOME/.local/bin"
printf '#!/bin/sh\\nexit 0\\n' > "$HOME/.local/bin/herdr-core"
chmod +x "$HOME/.local/bin/herdr-core"
if ! command -v hc >/dev/null 2>&1; then
    ln -s herdr-core "$HOME/.local/bin/hc"
fi
''')
        (self.fixtures / "app.sh").write_text('''#!/bin/sh
set -eu
command -v herdr-core >/dev/null
printf '#!/bin/sh\\nexit 0\\n' > "$HOME/.local/bin/herdr-app"
chmod +x "$HOME/.local/bin/herdr-app"
mkdir -p "$HOME/.local/share/applications"
printf '[Desktop Entry]\\nName=Herdr\\n' > "$HOME/.local/share/applications/herdr-app.desktop"
''')
        self.env = dict(os.environ, HOME=str(self.home),
                        PATH=f"{mocks}:/usr/bin:/bin",
                        HERDR_TEST_LOG=str(self.log),
                        HERDR_TEST_FIXTURES=str(self.fixtures))
        self.env.pop("HERDR_TEST_FAIL", None)

    @staticmethod
    def write_executable(path, contents="#!/bin/sh\nexit 0\n"):
        path.write_text(contents)
        path.chmod(0o755)

    def run_installer(self, check=True):
        return subprocess.run(["bash", str(ROOT / "bootstrap/install-herdr.sh")],
                              env=self.env, text=True, capture_output=True, check=check)

    def test_fresh_install_and_repeat_without_downloads_or_upgrades(self):
        self.run_installer()
        self.assertEqual(self.log.read_text().splitlines(), ["core", "app"])
        self.assertTrue((self.bin / "herdr-core").is_file())
        self.assertTrue((self.bin / "hc").is_symlink())
        self.assertTrue((self.bin / "herdr-app").is_file())
        self.assertTrue((self.home / ".local/share/applications/herdr-app.desktop").is_file())
        self.env["HERDR_TEST_FAIL"] = "core"
        self.run_installer()
        self.assertEqual(self.log.read_text().splitlines(), ["core", "app"])

    def test_existing_app_does_not_hide_missing_core_or_replace_unrelated_hc(self):
        self.write_executable(self.bin / "herdr-app", "#!/bin/sh\n# existing app\n")
        self.write_executable(self.bin / "hc", "#!/bin/sh\n# window-manager utility\n")
        self.run_installer()
        self.assertEqual(self.log.read_text().splitlines(), ["core"])
        self.assertIn("existing app", (self.bin / "herdr-app").read_text())
        self.assertIn("window-manager utility", (self.bin / "hc").read_text())
        self.assertTrue((self.bin / "herdr-core").is_file())

    def test_failed_core_download_does_not_execute_partial_script_or_install_app(self):
        self.env["HERDR_TEST_FAIL"] = "core"
        result = self.run_installer(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.log.read_text().splitlines(), ["core"])
        self.assertFalse((self.home / "partial-installer-ran").exists())
        self.assertFalse((self.bin / "herdr-app").exists())

    def test_failed_app_download_can_be_retried_without_reinstalling_core(self):
        self.env["HERDR_TEST_FAIL"] = "app"
        self.assertNotEqual(self.run_installer(check=False).returncode, 0)
        self.assertFalse((self.home / "partial-installer-ran").exists())
        self.env.pop("HERDR_TEST_FAIL")
        self.run_installer()
        self.assertEqual(self.log.read_text().splitlines(), ["core", "app", "app"])

    def test_successful_installer_must_supply_the_binary(self):
        (self.fixtures / "core.sh").write_text("#!/bin/sh\nexit 0\n")
        result = self.run_installer(check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("did not provide herdr-core", result.stderr)
        self.assertFalse((self.bin / "herdr-app").exists())


if __name__ == "__main__":
    unittest.main()
