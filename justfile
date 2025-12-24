# Review Notes Extension - Development Commands
# Run: just <command>

# Environment variables (set in ~/.zshrc or pass as arguments)
ovsx_token := env_var_or_default('OVSX_TOKEN', '')
vscode_pat := env_var_or_default('VSCODE_PAT', '')
publisher := "aikaisi"
namespace := "aikaisi"

# ═══════════════════════════════════════════════════════════════════════════════
# HELP
# ═══════════════════════════════════════════════════════════════════════════════

# Show available commands
default:
	@just --list --unsorted

# Show extension info and URLs
info:
	@echo "═══════════════════════════════════════════════════════"
	@echo "Extension: Review Notes"
	@echo "Publisher: aikaisi"
	@echo "═══════════════════════════════════════════════════════"
	@echo ""
	@echo "VS Code Marketplace:"
	@echo "  https://marketplace.visualstudio.com/items?itemName=aikaisi.review-notes"
	@echo ""
	@echo "Open VSX (Antigravity/VSCodium):"
	@echo "  https://open-vsx.org/extension/aikaisi/review-notes"

# ═══════════════════════════════════════════════════════════════════════════════
# DEVELOPMENT
# ═══════════════════════════════════════════════════════════════════════════════

# Install npm dependencies
install:
	npm install

# Compile TypeScript
compile:
	npm run compile

# Watch mode - auto-compile on save
watch:
	npm run watch

# Run ESLint
lint:
	npm run lint

# Clean build artifacts
clean:
	rm -rf out/
	rm -f *.vsix

# Full rebuild (clean + compile)
rebuild:
	just clean
	just compile

# Open project in VS Code
dev:
	code .

# ═══════════════════════════════════════════════════════════════════════════════
# PACKAGING
# ═══════════════════════════════════════════════════════════════════════════════

# Create .vsix package
package:
	npx vsce package

# Install extension from local .vsix
install-local:
	open -a "Visual Studio Code" --args --install-extension review-notes-*.vsix

# Uninstall extension from VS Code
uninstall:
	code --uninstall-extension aikaisi.review-notes

# ═══════════════════════════════════════════════════════════════════════════════
# AUTHENTICATION
# ═══════════════════════════════════════════════════════════════════════════════

# Login to VS Code Marketplace (Microsoft Azure DevOps PAT)
login-vscode:
	npx vsce login {{publisher}}

# Create Open VSX namespace (Eclipse - first time only)
create-openvsx-namespace:
	npx ovsx create-namespace {{namespace}} -p {{ovsx_token}}

# ═══════════════════════════════════════════════════════════════════════════════
# PUBLISHING - VS Code Marketplace (Microsoft)
# ═══════════════════════════════════════════════════════════════════════════════

# Publish to VS Code Marketplace
publish-vscode:
	npx vsce publish

# Publish patch version (0.1.0 -> 0.1.1) to VS Code
publish-vscode-patch:
	npx vsce publish patch

# Publish minor version (0.1.0 -> 0.2.0) to VS Code
publish-vscode-minor:
	npx vsce publish minor

# Publish major version (0.1.0 -> 1.0.0) to VS Code
publish-vscode-major:
	npx vsce publish major

# ═══════════════════════════════════════════════════════════════════════════════
# PUBLISHING - Open VSX (Eclipse) - for Antigravity/VSCodium
# ═══════════════════════════════════════════════════════════════════════════════

# Publish to Open VSX
publish-openvsx:
	npx ovsx publish -p {{ovsx_token}}

# ═══════════════════════════════════════════════════════════════════════════════
# PUBLISHING - BOTH MARKETPLACES
# ═══════════════════════════════════════════════════════════════════════════════

# Publish current version to both marketplaces
publish-all:
	just publish-vscode
	just publish-openvsx

# Release patch (0.1.0 -> 0.1.1) to both marketplaces
release-patch:
	just publish-vscode-patch
	just publish-openvsx

# Release minor (0.1.0 -> 0.2.0) to both marketplaces
release-minor:
	just publish-vscode-minor
	just publish-openvsx

# Release major (0.1.0 -> 1.0.0) to both marketplaces
release-major:
	just publish-vscode-major
	just publish-openvsx
