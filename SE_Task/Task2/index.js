let express = require('express');
let app = express();
let crawler = require('./crawler');

const PORT = 3000;

app.use(express.static('public'));
app.use(express.static('css'));
app.use(express.static('js'));
app.use(express.urlencoded());
app.use(express.json());

app.set('view engine', 'ejs');
app.set('views', './views');
app.listen(PORT, () => {
    console.log("Running on port: " + PORT);
});

app.get('/', (req, res) => {
    res.render('crawler');
})

app.post('/crawl', (req, res) => {
    let crawlerLink = req.body.crawlerLink;
    console.log(crawlerLink)
    crawler.run(crawlerLink)
        .then((info) => res.render('information', { data: info }))
        .catch((err) => console.log(err));
})
