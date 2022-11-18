const cheerio = require('cheerio');

const axios = require('axios');

const excel = require('exceljs');

const fs = require('fs');

///const crawlURL = 'https://jprp.vn/index.php/JPRP/issue/archive';

let workbook;
let sheets;

let g;
let arr = [];

async function initExcel() {
    ///console.log(1);
    workbook = new excel.Workbook();
    sheets = workbook.addWorksheet("Data");
    sheets.columns = [
        { header: "Số thứ tự", key: "numbering" },
        { header: "Tên báo", key: "title", width: 60 },
        { header: "Tác giả", key: "authors" },
        { header: "Ngày xuất bản", key: "releaseDate" },
        { header: "Tên số báo", key: "collection" },
    ];
    return;
}

async function addData(data) {
    ///console.log(data);
    await sheets.addRow(data);
}

async function fetchData(crawlURL) {
    let response = await axios(crawlURL).catch((err) => console.log(crawlURL));

    while (response?.status != 200) {
        ///console.log("Error occurred while fetching data from " + crawlURL);
        console.log("Error occurred, refetching data from " + crawlURL);
        response = await axios(crawlURL).catch((err) => console.log(crawlURL));
    }

    return response.data;
}

async function getArticlesInfo(crawlURL) {
    let articleInfoList = [];
    const $ = cheerio.load(await fetchData(crawlURL));
    let numbering = 0;
    const collectionLinks = $('.issue-summary .media-body .title').map((i, el) => $(el).attr('href')).toArray();
    const collectionPages = await Promise.all(collectionLinks.map(async (collectionLink) => {
        return cheerio.load(await fetchData(collectionLink));
    }));

    for (let collectionPage of collectionPages) {
        const articleLinks = collectionPage('.article-summary.media .media-body')
            .map((i, el) => collectionPage(el).find('a').attr('href'))
            .toArray();

        const htmls = await Promise.all(articleLinks.map(async (articleLink) => {
            return cheerio.load(await fetchData(articleLink));
        }));

        for (let html of htmls) {
            const arrticleInfoQuery = html('meta');
            const info = await Promise.all([
                (async () => html('meta[name="citation_title"]').attr('content').trim())(),
                (async () => html('meta[name="citation_author"]').attr('content'))(),
                (async () => html('meta[name="citation_date"]').attr('content'))(),
                (async () => html('.panel.panel-default.issue .panel-body a').text().trim())()]);

            ///console.log(info);
            let articleInfo = {
                'numbering': ++numbering,
                'title': info[0],
                'authors': info[1],
                'releaseDate': info[2],
                'collection': info[3],
            };
            articleInfoList.push(articleInfo);
            break;
            ///await addData(articleInfo);
        }
        break;
    }
    return articleInfoList;
}

async function run(crawlURL) {
    console.time("Crawl completed in");
    console.log("Start crawler");
    ///await initExcel();
    let res = await getArticlesInfo(crawlURL);
    console.timeEnd("Crawl completed in");
    return res;
    ///await workbook.xlsx.writeFile("Articles Infomation.xlsx");
}

module.exports = {
    run: run
}
