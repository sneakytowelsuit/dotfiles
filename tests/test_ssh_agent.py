"""Check that shells and desktop services select the same SSH agent."""

import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[1]
GENERATOR = Path("/usr/lib/systemd/user-environment-generators/30-systemd-environment-d-generator")


class SSHAgentEnvironmentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="workstation-ssh-test-")
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name)
        (self.home / ".zshenv").symlink_to(ROOT / "dotfiles/.zshenv")
        zsh_config = self.home / ".config/zsh"
        zsh_config.mkdir(parents=True)
        (zsh_config / ".zshenv").symlink_to(ROOT / "dotfiles/.config/zsh/.zshenv")
        self.runtime = self.home / "run"
        self.runtime.mkdir(mode=0o700)
        self.env = dict(os.environ, HOME=str(self.home),
                        XDG_CONFIG_HOME=str(self.home / ".config"),
                        XDG_RUNTIME_DIR=str(self.runtime))
        self.env.pop("SSH_AUTH_SOCK", None)
        self.env.pop("ZDOTDIR", None)

    def shell_socket(self):
        result = subprocess.run(
            ["zsh", "-c", 'print -r -- "${SSH_AUTH_SOCK-}"'],
            env=self.env, text=True, capture_output=True, check=True,
        )
        return result.stdout.strip()

    @unittest.skipUnless(shutil.which("zsh"), "zsh is required")
    def test_new_shell_selects_shared_socket(self):
        self.assertEqual(self.shell_socket(), str(self.runtime / "ssh-agent.socket"))

    @unittest.skipUnless(shutil.which("zsh"), "zsh is required")
    def test_child_shell_with_inherited_zdotdir_selects_shared_socket(self):
        self.env["ZDOTDIR"] = str(self.home / ".config/zsh")
        self.assertEqual(self.shell_socket(), str(self.runtime / "ssh-agent.socket"))

    @unittest.skipUnless(shutil.which("zsh"), "zsh is required")
    def test_forwarded_or_explicit_agent_is_preserved(self):
        self.env["SSH_AUTH_SOCK"] = "/tmp/forwarded-agent/agent.123"
        self.assertEqual(self.shell_socket(), self.env["SSH_AUTH_SOCK"])

    @unittest.skipUnless(shutil.which("zsh"), "zsh is required")
    def test_shell_without_user_runtime_does_not_invent_a_socket(self):
        self.env.pop("XDG_RUNTIME_DIR")
        self.assertEqual(self.shell_socket(), "")

    @unittest.skipUnless(GENERATOR.is_file(), "systemd environment generator is required")
    def test_desktop_environment_selects_shared_socket(self):
        config_dir = self.home / ".config/environment.d"
        config_dir.mkdir(parents=True)
        (config_dir / "60-ssh-agent.conf").symlink_to(
            ROOT / "dotfiles/.config/environment.d/60-ssh-agent.conf")
        result = subprocess.run([str(GENERATOR)], env=self.env,
                                text=True, capture_output=True, check=True)
        self.assertIn(f"SSH_AUTH_SOCK={self.runtime}/ssh-agent.socket", result.stdout)


if __name__ == "__main__":
    unittest.main()
