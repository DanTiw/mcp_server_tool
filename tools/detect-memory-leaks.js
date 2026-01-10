import fs from "fs/promises";
import path from "path";
import { findCSharpFiles } from "../utils/file-parser.js";
import { memoryLeakPatterns } from "../utils/microservice-patterns.js";

/**
 * Detects potential memory leaks in C# code
 */
export async function detectMemoryLeaks(targetPath) {
    try {
        const stats = await fs.stat(targetPath);
        let files = [];

        if (stats.isFile()) {
            files = [targetPath];
        } else {
            files = await findCSharpFiles(targetPath);
        }

        const issues = [];

        for (const file of files) {
            const content = await fs.readFile(file, "utf-8");
            const lines = content.split('\n');

            const fileIssues = scanFileForLeaks(content, lines, path.basename(file));
            if (fileIssues.length > 0) {
                issues.push(...fileIssues);
            }
        }

        return {
            content: [
                {
                    type: "text",
                    text: formatReport(issues)
                }
            ]
        };

    } catch (error) {
        throw new Error(`Memory leak detection failed: ${error.message}`);
    }
}

function scanFileForLeaks(content, lines, filename) {
    const issues = [];

    // Check 1: Event Subscription without Unsubscription
    // Simple heuristic: count += and -= for events. 
    // Ideally this needs AST, but regex is a good first pass for "potential" issues.
    const subMatches = content.match(memoryLeakPatterns.eventSubscription) || [];
    const unsubMatches = content.match(memoryLeakPatterns.eventUnsubscription) || [];

    if (subMatches.length > unsubMatches.length) {
        issues.push({
            file: filename,
            severity: "Medium",
            type: "Event Handler Leak",
            message: `Found ${subMatches.length} event subscriptions (+=) but only ${unsubMatches.length} unsubscriptions (-=). Ensure you unsubscribe from events to prevent memory leaks, especially in long-lived objects.`
        });
    }

    // Check 2: IDisposable Usage
    if (content.match(/:.*IDisposable/) && !content.includes("Dispose()")) {
        issues.push({
            file: filename,
            severity: "High",
            type: "Missing Dispose",
            message: "Class implements IDisposable but does not appear to have a Dispose() method."
        });
    }

    // Check 3: Static Mutable Fields
    // (Scanning line by line for better context)
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (memoryLeakPatterns.staticFields.test(line)) {
            issues.push({
                file: filename,
                line: i + 1,
                severity: "Medium",
                type: "Static State",
                message: "Static mutable field detected. Static fields persist for the lifetime of the application and can hold references to large objects, causing leaks."
            });
        }

        // Check 4: Timer usage
        if (memoryLeakPatterns.timerCreation.test(line)) {
            if (!content.includes("Dispose")) {
                issues.push({
                    file: filename,
                    line: i + 1,
                    severity: "High",
                    type: "Unmanaged Resource",
                    message: "Timer created. Timers must be disposed to stop them from firing and holding references."
                });
            }
        }

        // Check 5: Async Void
        if (/async\s+void/.test(line)) {
            issues.push({
                file: filename,
                line: i + 1,
                severity: "High",
                type: "Async Void",
                message: "Avoid 'async void'. Exceptions in async void methods crash the process and they are difficult to track. Use 'async Task' instead."
            });
        }
    }

    return issues;
}

function formatReport(issues) {
    if (issues.length === 0) {
        return "## Memory Leak Analysis passed! ✅\n\nNo common memory leak patterns detected in the scanned files.";
    }

    let report = "# Memory Leak Analysis Report ⚠️\n\n";

    // Group by file
    const grouped = issues.reduce((acc, issue) => {
        acc[issue.file] = acc[issue.file] || [];
        acc[issue.file].push(issue);
        return acc;
    }, {});

    for (const [file, fileIssues] of Object.entries(grouped)) {
        report += `### ${file}\n`;
        fileIssues.forEach(issue => {
            const lineStr = issue.line ? ` (Line ${issue.line})` : "";
            report += `- **[${issue.severity}] ${issue.type}**${lineStr}: ${issue.message}\n`;
        });
        report += "\n";
    }

    return report;
}
