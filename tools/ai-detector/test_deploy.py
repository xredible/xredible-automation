"""Deployment guardrails, without an HF account or network access."""
import importlib.util
import os
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock, patch


class DeploymentTests(unittest.TestCase):
    def invoke(self, private=True, hardware="cpu-basic", account="Xrediblee"):
        api = MagicMock()
        api.whoami.return_value = {"name": account}
        api.repo_info.return_value = SimpleNamespace(private=private)
        api.get_space_runtime.return_value = SimpleNamespace(
            hardware=hardware, requested_hardware=hardware, stage="BUILDING")
        hub = SimpleNamespace(HfApi=MagicMock(return_value=api), CommitOperationAdd=MagicMock())
        path = Path(__file__).with_name("deploy_space.py")
        spec = importlib.util.spec_from_file_location("detector_deploy_test", path)
        module = importlib.util.module_from_spec(spec)
        with patch.dict(sys.modules, {"huggingface_hub": hub}), patch.dict(os.environ, {"HF_TOKEN": "test-only-not-real"}):
            spec.loader.exec_module(module)
            try:
                module.main()
            except RuntimeError:
                return api, hub, False
        return api, hub, True

    def test_private_free_allowlist(self):
        api, hub, ok = self.invoke()
        self.assertTrue(ok)
        self.assertTrue(api.create_repo.call_args.kwargs["private"])
        names = {call.kwargs["path_in_repo"] for call in hub.CommitOperationAdd.call_args_list}
        self.assertEqual(names, {"requirements.txt", "constants.py", "model.py", "engine.py", "text.py",
                                 "app.py", "jobs.py", "download_model.py", "THIRD_PARTY.md", "Dockerfile", "README.md"})
        api.add_space_secret.assert_not_called()
        api.request_space_hardware.assert_not_called()

    def test_public_existing_space_refused(self):
        api, _, ok = self.invoke(private=False)
        self.assertFalse(ok)
        api.create_commit.assert_not_called()

    def test_paid_hardware_refused(self):
        api, _, ok = self.invoke(hardware="cpu-upgrade")
        self.assertFalse(ok)
        api.create_commit.assert_not_called()

    def test_wrong_account_refused(self):
        api, _, ok = self.invoke(account="someone-else")
        self.assertFalse(ok)
        api.create_repo.assert_not_called()
