var MongoClient = require('mongodb').MongoClient;
var ObjectID = require('mongodb').ObjectID
const express = require('express')
var cors = require('cors');
const app = express()
const port = 5001

mongo_url = 'mongodb://10.10.12.65:27017/';

app.use(cors())

app.get('/',(req,res) => {
    res.send('ok')
}) 
MongoClient.connect(mongo_url, (err, db) => {
    var dbo = db.db("db_ok_v2");
    
    app.get('/branches', (req,res) => {
        dbo.collection("Branches").find({}).sort({"MFO":1}).toArray(function (err, result) {
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
    app.get('/ents',(req,res) => {
        dbo.collection("Entities").aggregate([
            {$match:{"STATUS":1,"PARENTCODE":null}},
            {$lookup:{from:"Personal",localField:"ID",foreignField:"DEPARTMENT_CODE",as:"PER"}},
            {$project:{ID:1,"PARENTCODE":1,REGIONID:1,NAME:1,TYPE:1,"PER.BRANCH":1,len:{$size:"$PER"}}},
            {$match:{"len":{$ne:0}}}
        ]).toArray((err,result)=>{
            if(err) throw err;
            else {
                res.send(result)
            }
        })
    })
    
})


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})