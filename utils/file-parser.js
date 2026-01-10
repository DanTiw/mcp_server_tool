import fs from "fs/promises";
import path from "path";
import { glob } from "glob";
import { XMLParser } from "fast-xml-parser";

const xmlParser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
});

/**
 * recursively list c# files in a directory
 */
export async function findCSharpFiles(dirPath) {
    try {
        const stats = await fs.stat(dirPath);
        if (stats.isFile()) {
            return dirPath.endsWith(".cs") ? [dirPath] : [];
        }

        // It's a directory
        const files = await glob("**/*.cs", {
            cwd: dirPath,
            absolute: true,
            ignore: ["**/bin/**", "**/obj/**", "**/node_modules/**", "**/.git/**"]
        });
        return files;
    } catch (err) {
        throw new Error(`Failed to find C# files in ${dirPath}: ${err.message}`);
    }
}

/**
 * Read and parse a .csproj file
 */
export async function parseCsProject(projectPath) {
    try {
        const stats = await fs.stat(projectPath);
        let filePath = projectPath;

        if (stats.isDirectory()) {
            const csprojFiles = await glob("*.csproj", { cwd: projectPath, absolute: true });
            if (csprojFiles.length === 0) {
                throw new Error(`No .csproj file found in ${projectPath}`);
            }
            filePath = csprojFiles[0];
        }

        const content = await fs.readFile(filePath, "utf-8");
        const project = xmlParser.parse(content);
        return { path: filePath, content: project };
    } catch (err) {
        throw new Error(`Failed to parse project file: ${err.message}`);
    }
}

/**
 * Simple regex-based C# parser helpers (since we can't easily use Roslyn in Node.js)
 * For a real production tool, we might shell out to a .NET CLI tool, 
 * but for this MCP, regex + simple parsing is sufficient for many patterns.
 */
export const csharpPatterns = {
    methodDefinition: /(public|private|protected|internal|static|async|override|virtual)\s+[\w<>]+\s+(\w+)\s*\(/g,
    classDefinition: /(public|private|protected|internal|static|abstract|sealed)\s+class\s+(\w+)/g,
    interfaceDefinition: /interface\s+(\w+)/g,
    usingStatement: /using\s+([\w.]+);/g,
    callsToDispose: /\.Dispose\(\)/g,
    usingBlock: /using\s*\(/g,
};
