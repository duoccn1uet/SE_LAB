const axios = require("axios");
const mdToHTML = require("./md-to-html").mdToHTML;
const cheerio = require("cheerio");

const {GITHUB_LINK, TOKEN} = require("./CONSTANTS");

let repoUrl;
let owner;
let repo;

function parseRepoURL(gitRepo) {
    repoUrl = gitRepo;
    owner = gitRepo.slice(GITHUB_LINK.length + 1).split('/')[0];
    repo = gitRepo.slice(GITHUB_LINK.length + 1).split('/')[1];
}

async function fetchData(url) {
    console.log("fetching data from: " + url);
    let response;
    for (let count = 1; count <= 100; ++count) {
        if (count > 1)
            console.log("Error occurred, refetching data from " + url);
        response = await axios.get(url, {
            headers: {
                // Authorization: `token ${TOKEN}`,
                accept: 'application/vnd.github+json',
            }
        }).catch((err) => console.log("fail when fetching from: " + url + "\n" + err));
        if (response?.status === 200)
            return response.data;
        if (response?.status === 401) {
            console.log("Token hình như đã hết hạn, hãy kiểm tra lại");
            return undefined;
        }
    }
    return undefined;
}

let releaseInfoList = [];

async function countReleases() {
    // https://github.com/mastodon/mastodon
    const data = cheerio.load(await fetchData(repoUrl));
    ///a[href="/${owner}/${repo}/releases"]
    return Number.parseInt(data(`a[href="/${owner}/${repo}/releases"] span.Counter[data-view-component]`).text());
}

/**
 *
 * Ví dụ: https://github.com/mastodon/mastodon
 * Mỗi trang sẽ có 30 releases.
 * Đầu tiên sẽ đếm số releases, sau đó dùng Promise.all để lấy releases trong tất cả các page.
 *
 * @returns {Promise<any[]>}
 */
async function fetchGithubRelease() {
    /// fetch name, commit, link, author
    let totalReleases = await countReleases();
    let releaseInfoList = [];/// = [...Array(totalReleases)];
    let numberOfPage = Math.ceil(totalReleases / 30);
    console.log(`Repo có tổng cộng ${numberOfPage} trang`);
    console.log(`Repo có tổng cộng ${totalReleases} release`);
    await Promise.all(
        [...Array(numberOfPage)].map(async (val, page) => {
            const apiLink = `https://api.github.com/repos/${owner}/${repo}/releases?page=${page + 1}`;
            const pageInfoArray = await fetchData(apiLink);
            await Promise.all(pageInfoArray.map((singleReleaseInfo, index) => {
                let releaseIndex = page * 30 + index;
                let mainInfo = {
                    number: releaseIndex + 1,
                    name: singleReleaseInfo.name,
                    tag_name: singleReleaseInfo.tag_name,
                    htmlUrl: singleReleaseInfo.html_url,
                    author: {
                        name: singleReleaseInfo.author.login,
                        gitUrl: singleReleaseInfo.author.html_url,
                        avtUrl: singleReleaseInfo.author.avatar_url,
                    },
                    createdAt: singleReleaseInfo.created_at,
                    publishedAt: singleReleaseInfo.published_at,
                    changeLog: singleReleaseInfo.body === "" ? `<b>Không có Change log</b>` : mdToHTML(singleReleaseInfo.body),
                };
                releaseInfoList[releaseIndex] = mainInfo;
            }));
        }));
    console.log(`Lấy được tổng cộng ${releaseInfoList.length} release`);
    if (totalReleases !== releaseInfoList.length) {
        console.warn('Số release lấy được không khớp với tổng số release, hãy kiểm tra lại');
    }
    return releaseInfoList;
}

function getCompareLink(prevVersion, curVersion, page) {
    return `https://api.github.com/repos/${owner}/${repo}/compare/${prevVersion}...${curVersion}?page=${page}`;
}

async function fetchCompare(url) {
    const data = await fetchData(url);
    return {
        totalCommits: data.total_commits,
        commitList: data.commits,
    };
}

async function getTotalCommitsBetweenTwoVersion(prevVersion, curVersion) {
    console.log(`Đang lấy tổng số commit giữa 2 commit ${prevVersion} và ${curVersion}`);
    const url = getCompareLink(prevVersion, curVersion, 1);
    let data = await fetchCompare(url);
    return data.totalCommits;
}

async function getCommitsBetweenTwoVersion(prevVersion, curVersion) {
    console.log(`Đang compare 2 commit ${prevVersion} và ${curVersion}`);
    const url = getCompareLink(prevVersion, curVersion, 1);
    let data = await fetchCompare(url);
    let commitList = data.commitList;
    let totalCommits = data.totalCommits;
    console.log("Tổng số commit là: " + totalCommits);
    const numberOfRemainComparePage = Math.ceil((totalCommits - 250) / 250);
    if (numberOfRemainComparePage > 0) {
        await Promise.all(
            Array(numberOfRemainComparePage).fill(0).map(async (data, idx) => {
                return (await fetchCompare(getCompareLink(prevVersion, curVersion, idx + 2))).commitList;
            })
        )
            .then(commitListPageList => {
                commitListPageList.forEach(commitListPage => {
                    commitList.push(...commitListPage);
                    ///console.log(`length:  + ${commitListPageList.length}, ${numberOfRemainComparePage}`)
                });
            })
            .catch(err => console.log(err));
    }
    console.log('Total sau khi call hết compare api ', totalCommits);
    console.log('Tổng số lượng data khi call hết compare api ', commitList.length);
    if (totalCommits !== commitList.length) {
        console.warn('Số lượng commits không khớp ! Vui lòng kiểm tra lại');
    }
    return commitList;
}

async function getCommitsOfVersion(idx) {
    let release = releaseInfoList[idx];
    if (release.commitsList !== undefined)
        return release.commitsList;
    if (idx + 1 < releaseInfoList.length) {
        release.commitsList = await getCommitsBetweenTwoVersion(releaseInfoList[idx + 1].tag_name, release.tag_name);
    } else {
        release.commitsList = [];
    }
    let commitsList = release.commitsList;
    for (let i = 0; i < commitsList.length; ++i) {
        let comment = commitsList[i].commit.message;
        comment = comment.replace(/\n/g, "<br>");
        let post = comment.search("<br>");
        if (post === -1)
            comment = "<b>" + comment + "</b>";
        else
            comment = "<b>" + comment.slice(0, post) + "</b>" + comment.slice(post);
        commitsList[i].commit.message = comment;
    }
    return commitsList;
}

async function getGithubReleases(gitRepo) {
    parseRepoURL(gitRepo);
    console.time("getGithubReleases");
    releaseInfoList = await fetchGithubRelease();
    await Promise.all(releaseInfoList.map(async (release, index) => {
        if (index + 1 < releaseInfoList.length)
            release.totalCommits = await getTotalCommitsBetweenTwoVersion(releaseInfoList[index + 1].tag_name, release.tag_name);
        else
            release.totalCommits = 0;
    }));
    console.timeEnd("getGithubReleases");
    return releaseInfoList;
}

module.exports = {
    getGithubReleases: getGithubReleases,
    getCommitsOfVersion: getCommitsOfVersion
}

// async function main() {
//     console.time("1");
//     parseRepoURL("https://github.com/trustwallet/wallet-core");
//     let data = await fetchGithubRelease();
//     console.log(data.length);
//     console.timeEnd("1");
// }
//
// main();