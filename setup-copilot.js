const fs = require('fs');
const path = require('path');
const os = require('os');

const MCP_SERVER_NAME = 'dotnet-review';
const SERVER_PATH = path.join(__dirname, 'index.js');

// Helper to find VS Code settings file
function getVSCodeSettingsPath() {
    const platform = os.platform();
    if (platform === 'win32') {
        return path.join(process.env.APPDATA, 'Code', 'User', 'settings.json');
    } else if (platform === 'darwin') {
        return path.join(os.homedir(), 'Library', 'Application Support', 'Code', 'User', 'settings.json');
    } else {
        return path.join(os.homedir(), '.config', 'Code', 'User', 'settings.json');
    }
}

async function setup() {
    console.log("🤖 Setting up Dotnet Review MCP for GitHub Copilot...");

    const settingsPath = getVSCodeSettingsPath();

    if (!fs.existsSync(settingsPath)) {
        console.error(`❌ VS Code settings file not found at: ${settingsPath}`);
        console.log("Please ensure VS Code is installed and you've run it at least once.");
        process.exit(1);
    }

    try {
        // Read and parse settings
        const settingsContent = fs.readFileSync(settingsPath, 'utf8');
        // Remove comments for JSON parsing (basic regex, careful with complex JSONC)
        const jsonContent = settingsContent.replace(/\/\/.*$/gm, '');
        let settings = {};

        try {
            settings = JSON.parse(jsonContent);
        } catch (e) {
            console.log("⚠️  Could not parse existing settings as standard JSON (likely contains comments).");
            console.log("   Please add the configuration manually to your settings.json:");
            console.log(JSON.stringify({
                "github.copilot.chat.mcpServers": {
                    [MCP_SERVER_NAME]: {
                        "command": "node",
                        "args": [SERVER_PATH]
                    }
                }
            }, null, 2));
            process.exit(1);
        }

        // Update settings
        settings["github.copilot.chat.mcpServers"] = settings["github.copilot.chat.mcpServers"] || {};
        settings["github.copilot.chat.mcpServers"][MCP_SERVER_NAME] = {
            "command": "node",
            "args": [SERVER_PATH]
        };

        // Write back
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

        console.log("✅ Successfully added MCP server to VS Code settings!");
        console.log(`📍 Server Path: ${SERVER_PATH}`);
        console.log(`\n🎉 You can now use the agent in GitHub Copilot Chat!`);
        console.log(`   Just restart VS Code -> Open Chat -> Ask "Check for memory leaks in this project"`);

    } catch (error) {
        console.error("❌ Failed to update settings:", error.message);
    }
}

setup();
