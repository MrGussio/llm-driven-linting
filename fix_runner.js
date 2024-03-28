import {LintError} from "./models/LintError.js";
import RULES from "./rules.json" assert {type: 'json'};
import {Op} from "sequelize";
import simpleGit from "simple-git";
import fs from "fs";
import {installPackages, REPOSITORIES_DIR, runLinter} from "./main.js";
import {Repository} from "./models/Repository.js";
import {sequelize} from "./models/Database.js";
import "./models/Configuration.js"
import {Run} from "./models/Run.js";
import {execSync} from "node:child_process";
import {TestResult} from "./models/TestResult.js";
import {TestResultError} from "./models/TestResultError.js";

const CONTEXT_RANGE = 16;
const OPENAI_API_TOKEN = "<OPEN_API_SECRET_HERE>";

async function getLintingErrors() {
    return await LintError.findAll({
        where: {
            error: {
                [Op.in]: RULES
            },
            id: {
                [Op.notIn]: sequelize.literal(
                        `(SELECT tr.lint_error_id FROM TestResults tr WHERE tr.context_size = ${CONTEXT_RANGE})`
                    )
            }
        },
        include: {
            model: Repository,
            include: Run
        }
    });
}

async function cloneRepository(error) {
    let git = simpleGit();
    const path = REPOSITORIES_DIR + error.Repository.name + "-fix";
    if (fs.existsSync(path)) {
        fs.rmSync(path, {recursive: true, force: true});
    }
    await git.clone(error.Repository.origin, path, ["-q"]);

    //Checkout correct commit.
    git = simpleGit(path);
    await git.checkout(error.Repository.commit);

    await installPackages(path);

    return path;
}

async function readFileContents(error, repoPath){
    const file = repoPath + '/' + error.file;
    return fs.readFileSync(file, {encoding: 'utf-8'}).split("\n");
}

async function getErrorContext(error, repoPath, content) {
    const lower = Math.max(0, error.line - CONTEXT_RANGE);
    const upper = Math.min(error.line + CONTEXT_RANGE, content.length);
    const context = content.slice(lower, upper);
    return context;
}

async function processLlmResponse(error, repoPath, fileContent, fix) {
    const file = repoPath + '/' + error.file;
    const lower = Math.max(0, error.line - CONTEXT_RANGE);
    const upper = Math.min(error.line + CONTEXT_RANGE, fileContent.length);
    const prefix = fileContent.slice(0, lower);
    const suffix = fileContent.slice(upper, fileContent.length);

    const newFileContent = prefix.concat(fix.split('\n')).concat(suffix);
    fs.writeFileSync(file, newFileContent.join("\n"));
}

function createPrompt(error, context) {
    const prompt = context.join("\n") + "\n" +
        "For the code block above, solve the following linting error: " +
        error.error + ": " + error.message + "\n" +
        "Apply a fix for the linting error in the code block above. Do not add or modify anything else, do not add any textual context, do not add additional brackets."
    return prompt;
}

async function processError(error) {
    console.log(error);
    console.log("Cloning repo..");
    const repoPath = await cloneRepository(error);
    // const repoPath = "/home/jelle/Documents/capitaselecta/repositories/TremulaJS-fix";
    console.log("Reading filecontent..");
    const fileContent = await readFileContents(error, repoPath);

    const testResult = await TestResult.create({
        lint_error_id: error.id,
        context_size: CONTEXT_RANGE
    });

    console.log("Running linter...");
    const before = await runLinter(repoPath, repoPath + error.file);
    for(const file of before) {
        for(const message of file.messages) {
            if(message.severity === 1)
                continue;
            const testResultError = TestResultError.create({
                test_result_id: testResult.id,
                state: 'before',
                file: file.filePath.replace(repoPath, "") ?? "",
                line: message.line,
                column: message.column,
                error: message.ruleId,
                message: message.message
            });
        }
    }

    console.log("Getting error context..");
    const context = await getErrorContext(error, repoPath, fileContent);
    console.log("Creating prompt...");
    const prompt = createPrompt(error, context);

    testResult.before_context = context.join("\n");
    testResult.prompt = prompt;
    await testResult.save();

    const llmResponse = await sendPrompt(prompt);

    if(llmResponse == null)
        return testResult;
    testResult.after_context = llmResponse;
    await testResult.save();
    console.log(llmResponse);
    console.log("Processing LLM response..");
    await processLlmResponse(error, repoPath, fileContent, llmResponse);

    console.log("Rerunning linter...");
    const after = await runLinter(repoPath, repoPath + error.file);

    for(const file of after) {
        for(const message of file.messages) {
            if(message.severity === 1)
                continue;
            const testResultError = TestResultError.create({
                test_result_id: testResult.id,
                state: 'after',
                file: file.filePath.replace(repoPath, "") ?? "",
                line: message.line,
                column: message.column,
                error: message.ruleId,
                message: message.message
            });
        }
    }

    return testResult;
}

async function sendPrompt(prompt) {
    const url = "https://api.openai.com/v1/chat/completions";
    const body = {
        "model": "gpt-3.5-turbo",
        "messages": [
            {
                "role": "user",
                "content": prompt,
            }
        ]
    }
    const result = await fetch(url, {
        method: "POST",
        headers: new Headers({
            "Authorization": "Bearer " + OPENAI_API_TOKEN,
            'Content-Type': 'application/json'
        }),
        body: JSON.stringify(body)
    });
    const json = await result.json();
    console.log(json);
    if(json.choices == null) {
        return null;
    }
    return json.choices[0].message.content;
}



/**
 * This method assigns the correct classification for a given TestResult entry
 * @param testResult The TestResult entry to be correctly classified
 * @returns {Promise<void>}
 */
async function classifyTestResult(testResult){
    const error = await LintError.findByPk(testResult.lint_error_id);
    const startLine = error.line - testResult.context_size;
    const endLine = error.line + testResult.context_size;
    const before = await TestResultError.findAll({
        where: {
            test_result_id: testResult.id,
            state: 'before',
        }
    });
    const after = await TestResultError.findAll({
        where: {
            test_result_id: testResult.id,
            state: 'after',
        }
    });

    const beforeInContext = before.filter((testErrorResult) => {
        return testErrorResult.line >= startLine && testErrorResult.line <= endLine
    }).length;

    const afterInContext = after.filter((testErrorResult) => {
        return testErrorResult.line >= startLine && testErrorResult.line <= endLine
    }).length;

    if(before.length < after.length) {
        return 'WORSENED';
    }

    if(after.length === 1) {
        if(after[0].error === null && after[0].message.includes("Parsing error:")) {
            return 'SYNTAX';
        }
    }

    if(before.length > after.length && beforeInContext > afterInContext) {
        return 'SUCCESS';
    }

    if(before.length === after.length && beforeInContext === afterInContext) {
        return 'STALE';
    }

    return 'UNCLASSIFIED';
}

const errors = await getLintingErrors();

for(const error of errors) {
    const testResult = await processError(error);
    const classification = await classifyTestResult(testResult);
    testResult.classification = classification;
    console.log("RESULT! ", classification);
    await testResult.save();
}
