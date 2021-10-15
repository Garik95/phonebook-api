var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID
const express = require('express')
var cors = require('cors');
const app = express()
const port = 5001

mongo_url = 'mongodb://10.10.12.65:27017/';

app.use(cors())

app.get('/', (req, res) => {
    res.send('ok')
})
MongoClient.connect(mongo_url, (err, db) => {
    var dbo = db.db("db_ok_v2");

    app.get('/branches', (req, res) => {
        dbo.collection("Branches").find({}).sort({ "MFO": 1 }).toArray(function (err, result) {
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    });
    // app.get('/entities',(req,res) => {
    //     if(req.query.regionid)
    //         dbo.collection("Entities").find({STATUS:1,PARENTCODE:null,REGIONID:req.query.regionid}).toArray((err,result) => {
    //             if(err) throw err;
    //             else {
    //                 res.send(result)
    //             }
    //         })
    // });
    app.get('/ents', (req, res) => {
        dbo.collection("Entities").aggregate([
            { $match: { "STATUS": 1, "PARENTCODE": null } },
            { $lookup: { from: "Personal", localField: "ID", foreignField: "DEPARTMENT_CODE", as: "PER" } },
            { $project: { ID: 1, "PARENTCODE": 1, REGIONID: 1, NAME: 1, TYPE: 1, "PER.BRANCH": 1, len: { $size: "$PER" } } },
            { $match: { "len": { $ne: 0 } } }
        ]).toArray((err, result) => {
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    });

    app.get('/nestedEntities', async (req, res) => {
        if (req.query.ID) {
            dbo.collection("Entities").aggregate([{ $match: { "STATUS": 1 } }, { $lookup: { from: "Personal", localField: "ID", foreignField: "DEPARTMENT_CODE", as: "DEP" } }, { $project: { "ID": 1, "PARENTCODE": 1, "REGIONID": 1, "NAME": 1, TYPE: 1, OPEN_TMP: 1, CLOSE_TMP: 1, CLOSE: { $ifNull: ["$CLOSE_TMP", 0] }, "CNT": { $size: "$DEP" } } }]).toArray((err, result) => {
                if (err) throw err;
                res.send(nest(result, Number(req.query.ID)));
            })
        } else {
            res.sendStatus(405);
        }
    });

    app.get('/personal', (req, res) => {
        req.query.DEPARTMENT_CODE = JSON.parse(req.query.DEPARTMENT_CODE);
        console.log(req.query);
        dbo.collection('Personal').find({ ...req.query, STATUS_CODE: { $ne: 4 } }, {
            projection: {
                "ID": 1,
                "FIRST_NAME": 1,
                "FAMILY": 1,
                "PATRONYMIC": 1,
                "STATUS_CODE": 1,
                "POST_CODE": 1,
                "DEPARTMENT_CODE": 1,
                "BRANCH": 1
            }
        }).sort({ "POST_CODE": 1 }).toArray((err, result) => {
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    });

    app.get('/posts', (req, res) => {
        dbo.collection("Posts").find({}).toArray((err, result) => {
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    });

    app.get('/birthday', (req, res) => {
        let date = new Date();
        let today = new Date().getDate().toLocaleString("en-US", {timeZone: 'Asia/Tashkent'});
        console.log(today);
        let tomorrow = date.setHours(24);
        console.log(today, tomorrow);
        dbo.collection("Personal").find({
            STATUS_CODE: {
                $ne: 4
            },
            $expr: {
                $function: {
                    body: `function (today, day) { 
                        
                        let b_day = new Date(day).getDate().toLocaleString("en-US", {timeZone: 'Asia/Tashkent'})
                        let month = new Date().getMonth().toLocaleString("en-US", {timeZone: 'Asia/Tashkent'})
                        let b_month = new Date(day).getMonth().toLocaleString("en-US", {timeZone: 'Asia/Tashkent'})
            
                        if (Number(today) === Number(b_day) && month === b_month) { return true }
                        return false; 
                    }`,
                    args: [today, "$BIRTHDAY"],
                    lang: "js"
                },
                // "$eq": [{ "$month": "$BIRTHDAY" }, 579744000000] 
            }
        }, { projection: {
            _id: 1,
            FIRST_NAME: 1,
            BIRTHDAY: 1
        }}).toArray((err, result) => {
            console.log(result);
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    })

});

function nest(items, ID = null, link = "PARENTCODE") {
    return items
        .filter(item => item[link] === ID)
        .map(item => ({ ...item, children: nest(items, item.ID) }))
}


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})