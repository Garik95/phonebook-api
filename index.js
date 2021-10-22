var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID
const express = require('express')
var cors = require('cors');
const app = express()
const port = 5001

mongo_url = 'mongodb://10.10.12.65:27017/';

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({extended:true}))

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
        if(req.query.DEPARTMENT_CODE)
            req.query.DEPARTMENT_CODE = JSON.parse(req.query.DEPARTMENT_CODE);

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
        }).sort({ "POST_CODE": 1 }).toArray((err, emps) => {
            if (err) throw err;
            else {
                ids = emps.map(item => {return String(item._id)});
                dbo.collection("Phonebook").find({"PERSONAL":{$in:ids}}).toArray((err, phones) => {
                    if (err) throw err;
                    else {
                        emps.forEach(emp => {
                            ext = phones.filter(phone => {
                                return emp._id == phone.PERSONAL
                            })[0]
                            emp['EXT'] = ext ? ext['EXPHONE'] : ''
                        })
                        res.send(emps)
                        // console.log(phones)
                        
                    }
                })
                // dbo.collection('Phonebook').find()
                // console.log(result);
                // res.send(emps)
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

    app.get('/entities-full', (req, res) => {
        dbo.collection("Entities").find({}).toArray((err, result) => {
            if (err) throw err;
            else {
                res.send(result)
            }
        })
    });

    app.post('/editExt',(req,res) => {
        if(req.body._id && req.body.ext) {
            dbo.collection("Phonebook").updateOne({"PERSONAL":req.body._id},{$set:{"PERSONAL":req.body._id,EXPHONE: req.body.ext}},{upsert:true},(err,result) => {
                if(err) throw err;
                else {
                    res.send(result)
                }
            })
        }else {
            console.log("errr");
        }
    })

    app.get('/birthday', (req, res) => {

        dbo.collection("Personal").find({
            STATUS_CODE: {
                $ne: 4
            },
        }, {
            projection: {
                _id: 1,
                FIRST_NAME: 1,
                FAMILY: 1,
                PATRONYMIC: 1,
                DEPARTMENT_CODE: 1,
                POST_CODE: 1,
                BIRTHDAY: 1,
            }
        }).toArray((err, result) => {
            let todays_b_days = result.filter(item => {
                let birthday = new Date(item.BIRTHDAY);
                let today = new Date();
                return birthday.getMonth() === today.getMonth() && birthday.getDate() === today.getDate();
            })

            let tommorows_b_days = result.filter(item => {
                let birthday = new Date(item.BIRTHDAY);
                let tomorrow = new Date()
                tomorrow.setDate(tomorrow.getDate() + 1)
                return birthday.getMonth() === tomorrow.getMonth() && birthday.getDate() === tomorrow.getDate();
            })


            if (err) throw err;
            else {
                res.send({
                    "today": [...todays_b_days],
                    "tomorrow": [...tommorows_b_days]
                })
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