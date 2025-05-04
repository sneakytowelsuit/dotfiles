args:
let
  nixvim = import (builtins.fetchGit {
    url = "https://github.com/nix-community/nixvim";
    ref = "nixos-24.11";
    rev = "5bef8e43ce16ee704c7b9fa9f48a07ce81c5c05d";
  });
in {
  imports = [
    nixvim.nixosModules.nixvim
  ];

  programs.nixvim = {
    enable = true;
    defaultEditor = true;
    enableMan = true;
    viAlias = true;
    vimAlias = true;

    colorschemes.dracula.enable = true;

    globals = {
      mapleader = " ";
      localleader = " ";
    };

    opts = {
      tabstop = 4;
      mouse = "a";
      shiftwidth = 2;
      number = true;
      relativenumber = true;
      smoothscroll = true;
      clipboard = "unnamedplus";
      signcolumn = "yes";
	  termguicolors = true;
    };

    plugins = {
	  alpha = {
		enable = true;
		theme = "theta";
	  };
	  barbar.enable = true;
	  blink-cmp.enable = true;
	  bufferline.enable = true;
	  chadtree.enable = true;
	  cmp = {
		enable = true;
		autoEnableSources = true;
		settings.sources = [
		  { name = "nvim-lsp"; }
		  { name = "path"; }
		  { name = "buffer"; }
		];
	  };
	  comment.enable = true;
	  conform-nvim.enable = true;
	  cursorline.enable = true;
	  direnv.enable = true;
	  emmet.enable = true;
	  fidget.enable = true;
      lualine.enable = true;
      lazygit.enable = true;
	  lsp-format.enable = true;
      neo-tree.enable = true;
	  nix.enable = true;
	  noice.enable = true;
	  none-ls = {
		enable = true;
		enableLspFormat = true;
      };
      rainbow-delimiters.enable = true;
      snacks.enable = true;
      web-devicons.enable = true;
      which-key.enable = true;
	  telescope.enable = true;
      treesitter = {
		enable = true;
		settings = {
		  auto_install = true;
		  # For Noice plugin
		  ensure_installed = [
			"vim"
			"regex"
			"lua"
			"bash"
			"markdown"
			"markdown_inline"
		  ];
		};
	  };
      lsp = {
		enable = true;
		inlayHints = true;
		servers = {
		  nixd.enable = true;
		  zls.enable = true;
		  rls.enable = true;
		  rust_analyzer = {
			enable = true;
			installCargo = true;
			installRustc = true;
		  };
		  gopls.enable = true;
		};
      };
    };
  };
}
