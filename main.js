import simpleGit from 'simple-git';
import fs from 'fs';
import {execSync} from "node:child_process";
import {Run} from "./models/Run.js";
import {LintError} from "./models/LintError.js";
import {Repository} from "./models/Repository.js";
import RULES from "./rules.json" assert {type: 'json'};
import {sequelize} from "./models/Database.js";
import {GithubRepository} from "./models/GithubRepository.js";
import {Op} from "sequelize";

export const REPOSITORIES_DIR = "/home/jelle/Documents/capitaselecta/repositories/";

/**
 * Clones a repository from a distributed host, and then also installs its npm/yarn packages.
 * @param repository The Repository object to be cloned
 * @returns {Promise<void>}
 */
async function cloneRepository(repository) {
    let git = simpleGit();
    const path = REPOSITORIES_DIR + repository.name;
    if (fs.existsSync(path)) {
        fs.rmSync(path, {recursive: true, force: true});
    }
    await git.clone(repository.origin, path, ["-q"]);

    //Checkout correct commit.
    git = simpleGit(path);
    await git.checkout(repository.commit);

    await installPackages(path);
}

/**
 * Clears the source files of the given repository in the repositories folder on the filesystem.
 * @param repository The Repository object to be cleared
 * @returns {Promise<void>}
 */
async function clearFolder(repository) {
    const path = REPOSITORIES_DIR + repository.name;
    if (fs.existsSync(path)) {
        fs.rmSync(path, {recursive: true, force: true});
    }
}

/**
 * Runs yarn or NPM install in the given path directory, depending on what type of project
 * is encountered.
 * @param path The filepath on the system of the repository to install dependencies from
 * @returns {Promise<void>}
 */
export async function installPackages(path) {
    if(fs.existsSync(path + "/yarn.lock")) {
        execSync("yarn install", {cwd: path});
        return;
    }

    execSync("npm install", {cwd: path});
}

/**
 * Checks whether a repository has already been checked for linting errors and exists
 * in the given database.
 * @param repository The Repository object to be checked
 * @returns {Promise<boolean>} True if it already exists, false otherwise.
 */
async function hasRepositoryBeenExecuted(repository) {
    const result = await Repository.findAll({
        where: {
            origin: `git@github.com:${repository.org}/${repository.repo}.git`,
            commit: repository.commit,
            // status: "success"
        }
    });

    return result.length > 0;
}

/**
 * Returns a string of all rules to be applied on the command line of ESLint.
 * @returns {string}
 */
function getRulesListCLI() {
    let result = ""
    for(const rule of RULES) {
        result += `--rule '${rule}: error' `;
    }
    return result.trim();
}

/**
 * Runs the ESLint CLI on the given repository
 * @param repository A Repository object
 * @returns {Promise<any>}
 */
async function runCliLinter(repository) {
    await cloneRepository(repository);
    console.log(`Cloned and installed ${repository.name}!`);
    const cwd = REPOSITORIES_DIR + repository.name;
    return runLinter(cwd, repository.files);
}

/**
 * Runs the linter on the given repository path, and returns all linting errors
 * as a list.
 * @param repoPath The filepath to the repository.
 * @param files The files to be included for this linter
 * @returns {Promise<[]>} List of linting errors
 */
export async function runLinter(repoPath, files) {
    try {
        const output = (await execSync("eslint " + files + " " + getRulesListCLI() + " --f json --no-error-on-unmatched-pattern", {
            cwd: repoPath,
        })).toString();
        const results = JSON.parse(output);
        console.log(results.length);
        return results;
    } catch (e) {
        return JSON.parse(e.stdout.toString());
    }
}

/**
 * Processes and saves the results of the ESLint CLI to the database
 * @param results An array of JSON results parsed from the CLI
 * @param run The Run object which this result belongs to
 * @param repository The Repository this result belongs to
 * @returns {Promise<void>}
 */
async function processResult(results, run, repository) {
    const errors = [];
    const repositoryDirectory = REPOSITORIES_DIR + repository.name;
    for(const result of results) {
        for(const message of result.messages) {
            if(message.severity === 1)
                continue;

            const error = {
                repository_id: repository.id,
                file: result.filePath.replace(repositoryDirectory, "") ?? "",
                line: message.line,
                column: message.column,
                error: message.ruleId,
                message: message.message
            };
            errors.push(error);
        }
    }
    await LintError.bulkCreate(errors);
}

async function main() {
    // await sequelize.sync({force: true});
    const run = await Run.create({started: Date.now()});

    const repositories = await GithubRepository.findAll({where: {
        commit: {
            [Op.ne]: null
        },
        createdAt: {
            [Op.lt]: '2024-01-23 11:50:31.634 +00:00' //filter out earlier lookup of APIs
        }
        }});

    for(const githubRepository of repositories) {
        // const repository = {
        //     name: githubRepository.repo,
        //     repository: `git@github.com:${githubRepository.org}/${githubRepository.repo}.git`,
        //     files: "**.js **.ts",
        //     commit: githubRepository.commit
        // }
        console.log(githubRepository);
        if(await hasRepositoryBeenExecuted(githubRepository)) {
            console.log("Skipping " + githubRepository.repo + ", already exists.")
            continue;
        }
        const repositoryRecord = await Repository.create({
            run_id: run.id,
            origin: `git@github.com:${githubRepository.org}/${githubRepository.repo}.git`,
            name: githubRepository.repo,
            commit: githubRepository.commit,
            started: Date.now()
        });

        try {
            const results = await runCliLinter(repositoryRecord);
            await processResult(results, run, repositoryRecord);
            repositoryRecord.status = "success";
        } catch (e) {
            console.log(e);
            repositoryRecord.status = "failed";
        }
        repositoryRecord.finished = Date.now();
        await repositoryRecord.save();

        await clearFolder(repositoryRecord);
    }
    // await runLinter(INSTANCES[1]);

    run.finished = Date.now();
    await run.save();
}

// main();
await sequelize.sync({alter: true});
// doSearch(
//     "NOT eslint language:javascript language:typescript pushed:>2020-01-01 archived:false fork:false",
//     "stars",
//     100,
//     1);
// await lookupCommits(
