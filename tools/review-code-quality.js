import fs from "fs/promises";
import path from "path";
import { findCSharpFiles } from "../utils/file-parser.js";
import { antiPatterns } from "../utils/microservice-patterns.js";

/**
 * Reviews C# code quality and API optimization
 */
export async function reviewCodeQuality(targetPath) {
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

            const fileIssues = scanFileForQuality(content, lines, path.basename(file));
            if (fileIssues.length > 0) {
                issues.push(...fileIssues);
            }
        }

        return {
            content: [
                {
                    type: "text",
                    text: formatQualityReport(issues)
                }
            ]
        };

    } catch (error) {
        throw new Error(`Code quality review failed: ${error.message}`);
    }
}

function scanFileForQuality(content, lines, filename) {
    const issues = [];

    // 1. API Optimization / N+1 Detection
    // Check for DB calls inside loops
    let loopDepth = 0;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        if (line.match(/foreach|for\s*\(/)) {
            loopDepth++;
        }
        if (line.match(/^\s*}/)) {
            if (loopDepth > 0) loopDepth--;
        }

        if (loopDepth > 0) {
            // Very basic N+1 heuristic: await call to repository or DB context inside a loop
            if (line.match(/await\s+.*\.(Get|Find|Fetch|Query|ToListAsync)/) && !line.includes("Task.WhenAll")) {
                issues.push({
                    file: filename,
                    line: i + 1,
                    severity: "High",
                    type: "Performance / N+1 Problem",
                    message: "Database call detected inside a loop. This causes the N+1 problem. Fetch all data in a single query before the loop."
                });
            }
        }
    }

    // 2. Exception Handling
    if (antiPatterns.emptyCatch.test(content)) {
        issues.push({
            file: filename,
            severity: "Medium",
            type: "Empty Catch Block",
            message: "Empty catch block detected. Always log exceptions or handle them appropriately. swallowing errors hides bugs."
        });
    }

    if (antiPatterns.genericCatch.test(content)) {
        issues.push({
            file: filename,
            severity: "Low",
            type: "Generic Exception Catch",
            message: "Catching 'Exception' is too broad. Catch specific exceptions to handle known error states correctly."
        });
    }

    // 3. Architecture Violations
    if (antiPatterns.businessLogicInController.pattern.test(filename)) {
        if (antiPatterns.businessLogicInController.indicator.test(content)) {
            issues.push({
                file: filename,
                severity: "Medium",
                type: "Architecture / Separation of Concerns",
                message: antiPatterns.businessLogicInController.message
            });
        }

        if (antiPatterns.directDbAccessInController.pattern.test(content)) {
            issues.push({
                file: filename,
                severity: "High",
                type: "Architecture / Database Access",
                message: antiPatterns.directDbAccessInController.message
            });
        }
    }

    // 4. Async Best Practices
    if (antiPatterns.syncOverAsync.test(content)) {
        issues.push({
            file: filename,
            severity: "High",
            type: "Async / Sync-over-Async",
            message: "Blocking wait on Task detected (.Result or .Wait()). This can cause deadlocks. Use 'await' instead."
        });
    }

    // 5. Naming Conventions (Basic)
    const privateFieldBad = /private\s+\w+\s+[a-z][a-zA-Z0-9]*;/g; // e.g. private string name; (should be _name)
    // Note: Modern .NET conventions vary (some use _ for fields, some don't). checking against standard _camelCase.
    // We'll skip this specific check to avoid noise as it's subjective, but keep the placeholder for extension.

    return issues;
}

function formatQualityReport(issues) {
    if (issues.length === 0) {
        return "## Code Quality Review passed! ✅\n\nNo major quality or performance issues detected in the scanned files.";
    }

    let report = "# Code Quality & Performance Report 🔍\n\n";

    // Group by type for this report to highlight patterns
    const grouped = issues.reduce((acc, issue) => {
        acc[issue.type] = acc[issue.type] || [];
        acc[issue.type].push(issue);
        return acc;
    }, {});

    for (const [type, typeIssues] of Object.entries(grouped)) {
        report += `### ${type}\n`;
        typeIssues.forEach(issue => {
            report += `- **${issue.file}** (Line ${issue.line || "?"}): ${issue.message}\n`;
        });
        report += "\n";
    }

    return report;
}
