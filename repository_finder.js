import fetch from "node-fetch";
import {GithubRepository} from "./models/GithubRepository.js";
import parseLinkHeader from "parse-link-header";

const SEARCH_QUERY = "language:javascript language:typescript archived:false fork:false";

const API_TOKEN = "<API_TOKEN_HERE>";
export async function doSearch(query, sort, per_page, page) {
    const url = "https://api.github.com/search/repositories?" + new URLSearchParams({
        q: query,
        sort: sort ?? "",
        per_page: per_page ?? 30,
        page: page ?? 1
    })
    console.log(url);
    return fetch(url);
}

export async function doCommitLookup(org, repo) {
    return fetch(`https://api.github.com/repos/${org}/${repo}/commits?per_page=1&page=1`, {
        headers: new Headers({
            'Authorization': `Bearer ${API_TOKEN}`
        })
    });
}

export async function doRepoLookup(org, repo) {
    return fetch(`https://api.github.com/repos/${org}/${repo}`, {
        headers: new Headers({
            'Authorization': `Bearer ${API_TOKEN}`
        })
    });
}

export async function startLookup() {

    let lastPage = 1;
    while(true) {
        const results = await doSearch(SEARCH_QUERY, 'updated', 100, lastPage);
        const body = await results.json();
        if(results.status === 200) {
            let records = body['items'];
            records = records.map((f) => {
                return {
                    org: f.owner.login,
                    repo: f.name,
                    page: lastPage
                }
            });
            const createdRecords = await GithubRepository.bulkCreate(records, {updateOnDuplicate: ["page"]});
            console.log(`Created ${createdRecords.length} new repositories in index.`);
            lastPage++;
        }
        if(results.headers.get('X-RateLimit-Remaining') === "0") {
            const reset = Number(results.headers.get('X-RateLimit-Reset'));
            const now = (new Date()).getTime() / 1000;
            const waitingTime = reset - now + 10;
            console.log(`Waiting for ${waitingTime}`);
            await sleep(waitingTime * 1000);
        }
    }
}

export async function lookupCommits() {
    while(true) {
        const record = await GithubRepository.findOne({
            where: {
                commits: null
            }
        });
        if(record === null) {
            break;
        }

        const commit = await doCommitLookup(record.org, record.repo);

        if(commit.status === 403) {
            const reset = Number(commit.headers.get('X-RateLimit-Reset'));
            const now = (new Date()).getTime() / 1000;
            const waitingTime = reset - now + 10;
            console.log(`Waiting for ${waitingTime}`);
            await sleep(waitingTime * 1000);
            continue;
        }

        const repo = await doRepoLookup(record.org, record.repo);
        if(repo.status === 403) {
            const reset = Number(repo.headers.get('X-RateLimit-Reset'));
            const now = (new Date()).getTime() / 1000;
            const waitingTime = reset - now + 10;
            console.log(`Waiting for ${waitingTime}`);
            await sleep(waitingTime * 1000);
            continue;
        }


        const repoBody = await repo.json();
        record.commit = body[0].sha;
        record.stars = repoBody.stargazers_count;
        record.watchers = repoBody.watchers_count;
        record.forks = repoBody.forks_count;
        record.size = repoBody.size;

        const parsedLinkHeader = parseLinkHeader(commit.headers.get('Link'));
        const commits = parsedLinkHeader['last']['page'];
        record.commits = commits;
        await record.save();
        console.log(`${record.org}/${record.repo}: ${record.commits}`);
    }
}

function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
