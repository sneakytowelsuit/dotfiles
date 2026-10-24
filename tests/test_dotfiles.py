"""Exercise deployment and the one-time Stow migration in disposable homes."""

import importlib.util
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
MISE = shutil.which("mise")
spec = importlib.util.spec_from_file_location("migration", ROOT / "bootstrap/migrate-stow.py")
migration = importlib.util.module_from_spec(spec)
spec.loader.exec_module(migration)


class DotfilesTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="workstation-test-")
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / "home"
        self.home.mkdir()
        self.env = dict(os.environ, HOME=str(self.home), MISE_YES="1")
        for key, suffix in {
            "XDG_CONFIG_HOME": ".config", "XDG_DATA_HOME": ".local/share",
            "XDG_CACHE_HOME": ".cache", "XDG_STATE_HOME": ".local/state",
            "MISE_CONFIG_DIR": ".config/mise", "MISE_DATA_DIR": ".local/share/mise",
            "MISE_CACHE_DIR": ".cache/mise", "MISE_STATE_DIR": ".local/state/mise",
            "MISE_GLOBAL_CONFIG_FILE": ".config/mise/config.toml",
        }.items():
            self.env[key] = str(self.home / suffix)

    def run_mise(self, *args, check=True):
        return subprocess.run([MISE, "-C", str(ROOT), *args], env=self.env,
                              text=True, capture_output=True, check=check)

    @unittest.skipUnless(MISE, "mise is required")
    def test_fresh_deployment_and_repeat(self):
        self.run_mise("trust", str(ROOT / "mise.toml"))
        self.run_mise("dotfiles", "apply")
        self.run_mise("dotfiles", "apply")
        for path in (".gitconfig", ".zshenv", ".config/zsh/.zshrc",
                     ".config/niri/config.kdl", ".config/mise/config.toml"):
            self.assertEqual((self.home / path).resolve(), ROOT / "dotfiles" / path)
        self.assertFalse((self.home / ".config/zsh/.zcompdump").exists())

    @unittest.skipUnless(MISE, "mise is required")
    def test_unmanaged_file_is_preserved(self):
        target = self.home / ".gitconfig"
        target.write_text("keep my local configuration\n")
        self.run_mise("trust", str(ROOT / "mise.toml"))
        result = self.run_mise("dotfiles", "apply", check=False)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(target.read_text(), "keep my local configuration\n")
        self.assertFalse(target.is_symlink())

    @unittest.skipUnless(MISE, "mise is required")
    def test_legacy_links_are_migrated_without_removing_user_files(self):
        (self.home / ".config").mkdir()
        (self.home / ".config/niri").symlink_to(ROOT / "dotfiles/niri/.config/niri")
        (self.home / ".gitconfig").symlink_to(ROOT / "dotfiles/git/.gitconfig")
        (self.home / ".zshrc").symlink_to(ROOT / "dotfiles/zsh/.zshrc")
        unrelated = self.home / ".config/unrelated"
        unrelated.symlink_to("/somewhere/else")
        local = self.home / ".config/local-settings"
        local.write_text("preserve\n")
        command = ["python3", str(ROOT / "bootstrap/migrate-stow.py"), "--root", str(ROOT)]
        subprocess.run([*command, "--dry-run"], env=self.env, check=True, capture_output=True)
        self.assertTrue((self.home / ".gitconfig").is_symlink())
        subprocess.run(command, env=self.env, check=True, capture_output=True)
        subprocess.run(command, env=self.env, check=True, capture_output=True)
        self.assertFalse((self.home / ".gitconfig").is_symlink())
        self.assertTrue(unrelated.is_symlink())
        self.assertEqual(local.read_text(), "preserve\n")
        self.run_mise("trust", str(ROOT / "mise.toml"))
        self.run_mise("dotfiles", "apply")
        self.assertEqual((self.home / ".config/niri/config.kdl").resolve(),
                         ROOT / "dotfiles/.config/niri/config.kdl")

    def test_folded_config_directory_is_detected(self):
        (self.home / ".config").symlink_to(ROOT / "dotfiles/shell/.config")
        self.assertEqual(list(migration.legacy_links(self.home, {ROOT})), [self.home / ".config"])

    def test_image_sync_migrates_the_registered_checkout(self):
        checkout = Path(self.temp.name) / "old-checkout"
        registration = self.home / ".local/share/workstation/repo"
        registration.parent.mkdir(parents=True)
        registration.symlink_to(checkout)
        target = self.home / ".gitconfig"
        target.symlink_to(checkout / "dotfiles/git/.gitconfig")
        subprocess.run(["python3", str(ROOT / "bootstrap/migrate-stow.py"), "--root", str(ROOT)],
                       env=self.env, check=True, capture_output=True)
        self.assertFalse(target.is_symlink())


if __name__ == "__main__":
    unittest.main()
