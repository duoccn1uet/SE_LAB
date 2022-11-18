let a = [];
let b = [...Array(6)];

async function main() {
    a = (b.map((val, id) => {
        return id;
    }));
    console.log(a);
}

main();