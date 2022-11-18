const express = require('express');
const releaseCrawler = require('./controller/crawler.js');

const PORT = process.env.PORT || 1204;

const app = express();

app.use(express.urlencoded({extended: true}));
app.use(express.json());

const crawlDir = '/crawl_github';

app.set('view engine', 'ejs');
app.set('views', './views');

app.get("/", (req, res) => {
    res.render('main.ejs');
});

app.listen(PORT, () => {
    console.log(`Server is listening on port: ${PORT}`);
});

let releasesInfoList;

app.post(crawlDir, async (req, res) => {
    releasesInfoList = await releaseCrawler.getGithubReleases(req.body.githubRepo.trim());
    res.render("releases", {data: releasesInfoList});
});

app.get("/commits_detail", async (req, res) => {
    let index = Number.parseInt(req.query.index);
    res.render('commits', {
        commitsList: await releaseCrawler.getCommitsOfVersion(index),
    });
});

app.use(express.static('public'));
app.post("/show-changelog-commits", async (req, res) => {
    let index = Number.parseInt(req.body.index);
    await releaseCrawler.getCommitsOfVersion(index);
    res.render('show-changelog-commits', {
        data: releasesInfoList,
        index: index
    });
});