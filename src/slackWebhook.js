//const {IncomingWebhook} = require('@slack/client')
const AWS = require("aws-sdk");
const https = require('https');
const path = require('path');
const url = require('url');
//const axios = require('axios');
var transcribeservice = new AWS.TranscribeService();
var s3 = new AWS.S3();
const bucketName = process.env["WAVFILE_BUCKET"];
const callInfoTable = process.env["CALLINFO_TABLE_NAME"];
var documentClient = new AWS.DynamoDB.DocumentClient();

////////////////////////////////////////////////////////////////
/* This Lambda is aimed for parsing transcription result*/
/* Construct Slack message :: Caller*/
/* Make Slack message with given information and send through webhook*/
// ** phoneNumber: callInfo.phoneNumber,
// category : callInfo.category,
// transactionId: callInfo.transactionId,
// requestRecord: callInfo.record,
// requestTranscript: callInfo.transcript,
// status: callInfo.status
////////////////////////////////////////////////////////////////
exports.handler =  async (event, context, callback) => {
  console.log('EVENT');
  console.log(event);
  //////////////////////////////////////////////////////////////
  // setting transcription job
  const jobName = event.detail.TranscriptionJobName;
  var params = {
    TranscriptionJobName: jobName //'STRING_VALUE' /* required */,
    
  };
  console.log("TranscriptionJob Params : ", params)
  
  
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  /* Building Live Transcription result */
  //payload : [1]caseId, [2]phoneNumber, [3]category, [4]requestTranscript, [5]caseStatus
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  
  // transcribeservice.getTranscriptionJob(params, function(err, data) {
  //   if (err) console.log(err, err.stack); // an error occurred
  //   else {
  //     console.log('success : ', data);           // successful response
  //     console.log("Retrieved transcript : ", data.TranscriptionJob.TranscriptionJobName)
  //     //downloadFile(data.TranscriptionJob.TranscriptionJobName + '.json')
  //     //data.Transcript.TranscriptFileUri
  //     var TranscriptUri = data.TranscriptionJob.Media.MediaFileUri;
  //     console.log("BEFORE Transformed TrascriptUri : ", TranscriptUri);
  //     TranscriptUri.replace('wav', 'json');
  //     console.log("Transformed TrascriptUri : ", TranscriptUri);
  //     getTranscript(data.TranscriptionJob.Transcript.TranscriptFileUri).then(
  //         function(getTranscriptResponse) {
  //         console.log("Retrieved transcript:", getTranscriptResponse);
  //         //return writeTranscriptToS3(getTranscriptResponse,transcriptFileName);
  //         //await sendSlackMessage(getTranscriptResponse)
  //       }).catch(function(err) {
  //           console.error("Failed to process slackWebHook", err);
  //           callback(err, null);
  //       })
      
  //   } 
  // });
    
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  /* Query DDB */
    //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  
  const caseId = jobName;//.substring(0, jobName.length-2);
  const scannedRsult = await scanCaller('caseId', caseId);
  console.log('scanned result : ', scannedRsult);
  // transcribeservice.getTranscriptionJob(params, function(err, data) {
  //   if (err) console.log(err, err.stack); // an error occurred
  //   else     console.log(data);           // successful response
  // });

  console.log("scannedRsult.Items.caseId; ", scannedRsult.Items[0].caseId)

  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  /* Get Transcription result from S3 */
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  var s3Params = {
    Bucket: bucketName, 
    Key: caseId + '/' + scannedRsult.Items[0].callId + '-0.json'
   };
  console.log('S3 input params : ', s3Params)

  const transcript = await getTranscriptFromS3(s3Params);
  console.log('transcript from event body : ', transcript);
  updateCaller(transcript)

  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  /* Update Transcription result to DDB */
  //payload : [1]caseId, [2]phoneNumber, [3]category, [4]requestTranscript, [5]caseStatus
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////


  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  /* Building Message payload*/
  //payload : [1]caseId, [2]phoneNumber, [3]category, [4]requestTranscript, [5]caseStatus
  //////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////
  
  webhookMessagePayload.blocks[0].text.text = 'translate test';
  webhookMessagePayload.blocks[1].fields[0].text = "Case Id : "  + scannedRsult.Items[0].caseId;
  webhookMessagePayload.blocks[2].fields[0].text = "Phone Number : " + scannedRsult.Items[0].phoneNumber;
  webhookMessagePayload.blocks[3].fields[0].text =  "Catetory : " + scannedRsult.Items[0].category;
  webhookMessagePayload.blocks[4].fields[0].text =  "Transcript : " + transcript;
  webhookMessagePayload.blocks[5].fields[0].text =  "Case Status : " + scannedRsult.Items[0].caseStatus;

  const options = {
    hostname: "hooks.slack.com",
    method: "POST",
    path: "/services/T03CCRCU5B8/B03DPQC8FSP/n8nklFs2takaWcVJVxVgnpnr",
  };
  
  const webhookMessagePayloadVar = JSON.stringify(webhookMessagePayload) 
    
  console.log('webhookMessagePayloadVar : ', webhookMessagePayloadVar)
  
  //https://hooks.slack.com/services/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
  const req = https.request(options,
      (res) => res.on("data", () => callback(null, "OK")))
  req.on("error", (error) => callback(JSON.stringify(error)));
  req.write(webhookMessagePayloadVar);
  req.end();


}


//payload : [0]caseId, [2]phoneNumber, [2]category, [3]requestTranscript, [4]caseStatus
const webhookMessagePayload = {
  text: "New Case Opened",
  blocks: [
    {
      "type": "section",
      "text": {
        "type": "mrkdwn",
        "text": "New Case Opened"
      }
    },
    {
      "type": "section",
      "block_id": "section234",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseId*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section345",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*PhoneNumber*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section456",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Category*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section567",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*Transcript*"
        }
      ]
    },
    {
      "type": "section",
      "block_id": "section678",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "*CaseStatus*"
        }
      ]
    },
    {
      "type": "actions",
      "elements": [
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "emoji": true,
            "text": "Approve"
          },
          "style": "primary",
          "value": "click_me_123"
        },
        {
          "type": "button",
          "text": {
            "type": "plain_text",
            "emoji": true,
            "text": "Reject"
          },
          "style": "danger",
          "value": "click_me_123"
        }
      ]
    }
  ]
};

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* S3 Transcribe actions*/
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
async function getTranscriptFromS3(params) {

  try {
      const file = await s3
        .getObject({ Bucket: params.Bucket, Key: params.Key })
        .promise();
        
      const bodyString = file.Body.toString('utf8')
      const obj = JSON.parse(bodyString)
      console.log('transcripted json parse : ', JSON.stringify(obj));
      console.log('transcript final : ', JSON.stringify(obj.results.transcripts[0].transcript));
      return JSON.stringify(obj.results.transcripts[0].transcript);
    } catch (err) {
      console.log(err);
      return err;
    }
}
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* Dynamo DB actions*/
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
async function putCaller(callInfo) {
  var params = {
    TableName: callInfoTable,
    Item: {
      phoneNumber: callInfo.phoneNumber,
      caseId: callInfo.caseId,
      category : callInfo.category,
      transactionId: callInfo.transactionId,
      requestRecord: callInfo.requestRecord,
      requestTranscript: callInfo.requestTranscript,
      callId: callInfo.callId,
      caseStatus: callInfo.caseStatus
    },
  };

  try {
    const results = await documentClient.put(params).promise();
    console.log(results);
    return results;
  } catch (err) {
    console.log(err);
    return err;
  }
}

async function updateCaller(updateTranscript) {
  var params = {
    TableName: callInfoTable,
    Key: {
      requestTranscript: updateTranscript,
    },
    UpdateExpression: "set requestTranscript = :e",
    ExpressionAttributeValues: {
      ":e": updateTranscript,
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

async function getCaller(callInfo) {
  var params = {
    TableName: callInfoTable,
    Key: { phoneNumber: callInfo },
  };

  console.log(params);
  try {
    const results = await documentClient.get(params).promise();
    console.log(results);
    if (results) {
      const callInfo = {
        // phoneNumber: results.Item.phoneNumber,
        // accountId: results.Item.accountId,
        // id: results.Item.id,
        
        phoneNumber: callInfo.phoneNumber,
        caseId: callInfo.caseId,
        category : callInfo.category,
        transactionId: callInfo.transactionId,
        requestRecord: callInfo.record,
        requestTranscript: callInfo.transcript,
        callId: callInfo.callId,
        caseStatus: callInfo.status
      };
      console.log({ callInfo });
      return callInfo;
    } else {
      console.log("Account ID not found");
      return false;
    }
  } catch (err) {
    console.log(err);
    console.log("No phone found");
    return false;
  }
}

// aws dynamodb scan  --table-name SmaBridgingDemo-callInfo84B39180-11GVTD7302BI0  \
//     --filter-expression 'callId = :g' \
//     --expression-attribute-values '{
//         ":g": {"S":"ef079e52-7c82-4d0b-ab1a-ac64dfc6b91b"} 
//     }'

async function scanCaller(attributeName, attributeValue) {
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
}