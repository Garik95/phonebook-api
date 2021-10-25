var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID
const express = require('express')
const fetch = require("node-fetch");
var cors = require('cors');
const app = express()
const port = 5001

mongo_url = 'mongodb://10.10.12.65:27017/';

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get('/', (req, res) => {
    res.send('ok')
})

const elasticRequest = async function (url, raw) {
    console.log(url, raw);
    return new Promise(resolve => {
        var requestOptions = {
            method: 'POST',
            headers: {
                "Content-Type": "application/json"
            },
            body: raw,
            redirect: 'follow'
        };
        fetch(url, requestOptions)
            .then(response => response.text())
            .then(result => {
                resolve(result)
            })
            .catch(error => console.log('error', error));
    })
}

const formQuery = async function (dbo, id, size) {
    return new Promise(resolve => {
        dbo.collection('Personal').find({
            '_id': ObjectID(id),
            STATUS_CODE: {
                $ne: 4
            }
        }, {
            "FIRST_NAME": 1,
            "FAMILY": 1,
            "PATRONYMIC": 1
        }).toArray((err, result) => {
            if (err) res.send(err);
            else {
                var query = {
                    "from": 0,
                    "size": size,
                    "query": {
                        "bool": {
                            "should": [{
                                "match": {
                                    "FIRST_NAME": {
                                        "query": result[0].FIRST_NAME,
                                        "fuzziness": "AUTO"
                                    }
                                }
                            },
                            {
                                "match": {
                                    "FAMILY": {
                                        "query": result[0].FAMILY,
                                        "fuzziness": "AUTO"
                                    }
                                }
                            },
                            {
                                "match": {
                                    "PATRONYMIC": {
                                        "query": result[0].PATRONYMIC == null ? '' : result[0].PATRONYMIC,
                                        "fuzziness": "AUTO"
                                    }
                                }
                            }
                            ]
                        }
                    }
                }
                resolve(query)
            }
        })
    })
}

MongoClient.connect(mongo_url, (err, db) => {
    var dbo = db.db("db_ok_v2");

    app.get('/search', (req, res) => {
        var url = '';
        var raw = '';

        const exps = async function () {
            switch (req.query.space) {
                case 'all': {
                    url = "http://10.10.12.99:9200/" + 'newpers/test/_search';
                    raw = JSON.stringify({
                        "from": 0,
                        "size": req.query.size,
                        "query": {
                            "query_string": {
                                "query": `${req.query.q}*`
                            }
                        }
                    });
                    break;
                }
                case 'skud': {
                    url = "http://10.10.12.99:9200/" + 'skud/users/_search';
                    raw = JSON.stringify(await formQuery(dbo, req.query.q, req.query.size));
                    break;
                }
            }

            res.send(await elasticRequest(url, raw));
        }

        exps()
    })

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

    app.get('/personal', async (req, res) => {
        if (req.query.DEPARTMENT_CODE)
            req.query.DEPARTMENT_CODE = JSON.parse(req.query.DEPARTMENT_CODE);

        if (req.query._id) {
            req.query._id = ObjectID(String(req.query._id));
        }

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
                ids = emps.map(item => { return String(item._id) });
                dbo.collection("Phonebook").find({ "PERSONAL": { $in: ids } }).toArray((err, phones) => {
                    if (err) throw err;
                    else {
                        emps.forEach(emp => {
                            ext = phones.filter(phone => {
                                return emp._id == phone.PERSONAL
                            })[0]
                            emp['EXT'] = ext ? ext['EXPHONE'] : ''
                            emp['PIC'] = ext ? ext['PIC'] : ''
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

    app.post('/editExt', (req, res) => {
        if (req.body._id && req.body.ext) {
            dbo.collection("Phonebook").updateOne({ "PERSONAL": req.body._id }, { $set: { "PERSONAL": req.body._id, EXPHONE: req.body.ext } }, { upsert: true }, (err, result) => {
                if (err) throw err;
                else {
                    res.send(result)
                }
            })
        } else {
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
            ids = result.map(item => { return String(item._id) });
            dbo.collection("Phonebook").find({ "PERSONAL": { $in: ids } }).toArray((err, phones) => {
                if (err) throw err;
                else {
                    result.forEach(emp => {
                        ext = phones.filter(phone => {
                            return emp._id == phone.PERSONAL
                        })[0]
                        emp['EXT'] = ext ? ext['EXPHONE'] : ''
                        emp['PIC'] = ext ? ext['PIC'] : ''
                    })
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

                    let after_tommorows_b_days = result.filter(item => {
                        let birthday = new Date(item.BIRTHDAY);
                        let tomorrow = new Date()
                        tomorrow.setDate(tomorrow.getDate() + 2)
                        return birthday.getMonth() === tomorrow.getMonth() && birthday.getDate() === tomorrow.getDate();
                    })


                    if (err) throw err;
                    else {
                        res.send({
                            "today": [...todays_b_days],
                            "tomorrow": [...tommorows_b_days],
                            "after_tomorrow": [...after_tommorows_b_days]
                        })
                    }
                }
            })
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