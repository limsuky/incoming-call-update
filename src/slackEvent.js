const query = require ("querystring");
const callInfoTable = process.env["CALLINFO_TABLE_NAME"];
const AWS = require("aws-sdk");
var documentClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
    console.log ('##EVENT##');
    console.log (event);
    
    // TODO implement
    const response = {
        statusCode: 200,
        body: JSON.stringify('Hello from Lambda!'),
    };
    
    const params = query.parse(event.body);

    // REQUEST VALIDATION
    if(process.env.VERIFICATION_TOKEN !== params.token){
      response.statusCode = 401;
      response.body = 'Unauthorized';
      //return response;
      callback(null, response);
    }
    // else{
    //     response.body = params.text;
    //     //return response;
    //     console.log('res body : ', response.body);
    //     callback(null, response);
    // }
    console.log('params : ', params);
    let caseGetRes;
    let caseRes;
    let caseId = params.text;
    let queriedCase =[] ;
    //let ddbRes;
    console.log('command is : ', params.command);
    switch(params.command) {
      case "/openedcase":
        caseRes = await scanCase('caseStatus', 'open');
        console.log('ddb Scaned cases : ', caseRes);
        // console.log ('caseRes.Items.Count : ', caseRes.Count )
        responsePayloadBodyRe.blocks[0].text.text = 'Opened case(s) ';
        responsePayloadBodyRe.blocks[1].fields[0].text = "Number of opened case(s) is " + caseRes.Count + " of total case number(s) is" + caseRes.ScannedCount;
        for ( i = 0 ; i < caseRes.Count ; i++ ){
          queriedCase[i] = caseRes.Items[i].caseId;
        }
        caseRes = queriedCase.join(', ');
        responsePayloadBodyRe.blocks[2].fields[0].text = "Case Id(s) : "  + caseRes;
        // console.log('responsePayloadBody : ', JSON.stringify(responsePayloadBody));
        response.body = JSON.stringify(responsePayloadBodyRe) ;
        return response;

        case "/closedcase":
          caseRes = await scanCase('caseStatus', 'close');
          console.log('ddb Scaned cases : ', caseRes);
          // console.log ('caseRes.Items.Count : ', caseRes.Count )
          responsePayloadBodyRe.blocks[0].text.text = 'Closed case(s) ';
          responsePayloadBodyRe.blocks[1].fields[0].text = "Number of closed case(s) is " + caseRes.Count + " of total case number(s) is" + caseRes.ScannedCount;
          for ( i = 0 ; i < caseRes.Count ; i++ ){
            queriedCase[i] = caseRes.Items[i].caseId;
          }
          caseRes = queriedCase.join(', ');
          responsePayloadBodyRe.blocks[2].fields[0].text = "Case Id(s) : "  + caseRes;
          // console.log('responsePayloadBody : ', JSON.stringify(responsePayloadBody));
          response.body = JSON.stringify(responsePayloadBodyRe) ;
          return response;

      case "/makeclose":
        // validate if case exists. 
        if (caseGetRes = await getCase(caseId)){
          // process case update
          caseRes = await updateCase(caseId, 'close');
          console.log ('caseRes : ', caseRes);
          responsePayloadBody.blocks[0].text.text = 'Case Close request result';
          responsePayloadBody.blocks[1].fields[0].text = "Case Id : "  + caseId + " from caller " + caseGetRes.phoneNumber;
          responsePayloadBody.blocks[2].fields[0].text = "Case status :closed ";
          console.log('responsePayloadBody : ', JSON.stringify(responsePayloadBody));
          response.body = JSON.stringify(responsePayloadBody);
        }else{
          response.body = "INVALID CASE ID";
        }
        return response;
        break;
        
      case "/reopen":
        // validate if case exists. 
        if (caseGetRes = await getCase(caseId)){
          // process case update
          caseRes = await updateCase(caseId, 'open');
          console.log ('caseRes : ', caseRes);
          responsePayloadBody.blocks[0].text.text = 'Case ReOpen subject';
          responsePayloadBody.blocks[1].fields[0].text = "Case Id : "  + caseId + " from caller " + caseGetRes.phoneNumber;
          responsePayloadBody.blocks[2].fields[0].text = "Case status :reopened ";
          console.log('responsePayloadBody : ', JSON.stringify(responsePayloadBody));
          response.body = JSON.stringify(responsePayloadBody);
        }else{
          response.body = "INVALID CASE ID";
        }
        return response;
        break;
      default: 
        response.body = "INVALID command option";
        return response;
        break;
    }
};


//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* Response message payload */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

const responsePayloadBody = {
  text: "Case Body text",
  blocks: [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "Case status changed",
      }
    },
    {
      "type": "section",
      "block_id": "section234",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseId from Caller*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section345",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseId status*"
        }
      ]
    },
  ]
};

const responsePayloadBodyRe = {
  text: "Case Body text",
  blocks: [
    {
      "type": "header",
      "text": {
        "type": "plain_text",
        "text": "response subject header",
      }
    },
    {
      "type": "section",
      "block_id": "section234",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseId summary*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section345",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseId detail*"
        }
      ]
    },
  ]
};
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* Scan DDB if matched value exists */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

async function scanCase(attributeName, attributeValue) {
  console.log('scanCaller called')
    var params = {
    ExpressionAttributeNames: {
      "#e": attributeName
    }, 
    ExpressionAttributeValues: {
      ":g": attributeValue
    },
    FilterExpression: "#e = :g", 
    //ProjectionExpression: "#ST, #AT", 
    TableName: callInfoTable
   };
   console.log('params : ', params)
   return await documentClient.scan(params).promise();
};

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* UPDATE DDB to make case close, open */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
async function updateCase(caseId, caseStatus) {
  var params = {
    TableName: callInfoTable,
    Key: {
      caseId: caseId,
    },
    UpdateExpression: "set #E = :e",
    ExpressionAttributeNames: {
      "#E": 'caseStatus',
    },
    ExpressionAttributeValues: {
      ":e": caseStatus,
    },
  };
  console.log(params);
  try {
    const results = await documentClient.update(params).promise();
    console.log(results);
    return results;
  } catch (err) {
    console.log(err);
    return err;
  }
}

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* get Case Information */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
async function getCase(caseId) {
  console.log('getCaller called')
  var params = {
    TableName: callInfoTable,
    Key: { caseId: caseId },
  };

  console.log(params);
  try {
    const results = await documentClient.get(params).promise();
    console.log(results);
    if (results) {
      const callInfo = {
        phoneNumber: results.Item.phoneNumber,
        caseId: results.Item.caseId,
        category : results.Item.category,
        transactionId: results.Item.transactionId,
        requestRecord: results.Item.requestRecord,
        requestTranscript: results.Item.requestTranscript,
        callId: results.Item.callId,
        caseStatus: results.Item.caseStatus
      };
      console.log({ callInfo });
      return callInfo;
    } else {
      console.log("FOUND Case ID");
      return false;
    }
  } catch (err) {
    console.log(err);
    console.log("No Case ID found");
    return false;
  }
}

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* NEVER USED */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
async function queryCaller(caseId) {
  console.log('queryCaller called')
  const params = {
    ExpressionAttributeNames: {
      "#e": 'caseId'
    }, 
    ExpressionAttributeValues: {
      ":g": caseId
    },
    FilterExpression: "#e = :g", 
    //KeyConditionExpression: `#${attributeName} = :${attributeName}`,
    TableName: callInfoTable
  }
  return await documentClient.query(params).promise()
}
