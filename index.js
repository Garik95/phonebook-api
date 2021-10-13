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
    });

    app.get('/nestedEntities', async (req, res) => {
        if(req.query._id){
            dbo.collection("Entities").aggregate([{$match:{"_id":ObjectID(req.query._id),"STATUS":1}},{$lookup:{from:"Personal",localField:"ID",foreignField:"DEPARTMENT_CODE",as:"DEP"}},{$project:{"ID":1,"PARENTCODE":1,"REGIONID":1,"NAME":1,TYPE:1,OPEN_TMP:1,CLOSE_TMP:1,CLOSE:{$ifNull:["$CLOSE_TMP",0]},"CNT":{$size:"$DEP"}}}]).toArray((err,result) => {
                if (err) throw err;
                res.send(nest(result));
            })
        } else {
            res.sendStatus(405);
        }
    });
    
});

function nest(items, ID = null, link = "PARENTCODE") {
    return items
        .filter(item => item[link] === ID)
        .map(item => ({ ...item,children: nest(items, item.ID) }))
}


app.listen(port, () => {
    console.log(`Example app listening at http://localhost:${port}`)
})