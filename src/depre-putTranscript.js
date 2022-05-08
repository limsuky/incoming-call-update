const AWS = require("aws-sdk");
const https = require('https');
const path = require('path');
const url = require('url');
var transcribeservice = new AWS.TranscribeService();
var s3 = new AWS.S3();
const bucketName = process.env["BUCKET_NAME"];
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
exports.handler = (event, context, callback) => {
  console.log('EVENT');
  console.log(event);
  // setting transcription job
  const jobName = event.detail.TranscriptionJobName;
  var params = {
    TranscriptionJobName: jobName //'STRING_VALUE' /* required */,
    
  };
  console.log("TranscriptionJob Params : ", params)
  // get transcription job
  
  var job = transcribeservice.getTranscriptionJob(params, function(err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else {
      console.log('success : ', data);           // successful response
      console.log("Retrieved transcript : ", data.TranscriptionJob.TranscriptionJobName)
      //downloadFile(data.TranscriptionJob.TranscriptionJobName + '.json')
      //data.Transcript.TranscriptFileUri
      var TranscriptUri = data.TranscriptionJob.Media.MediaFileUri;
      console.log("BEFORE Transformed TrascriptUri : ", TranscriptUri);
      TranscriptUri.replace('.wav', '.json');
      console.log("Transformed TrascriptUri : ", TranscriptUri);
      getTranscript(data.TranscriptionJob.Transcript.TranscriptFileUri).then(
        function(getTranscriptResponse) {
        console.log("Retrieved transcript:", getTranscriptResponse);
      //  return writeTranscriptToS3(getTranscriptResponse,transcriptFileName);
      sendSlackMessage(getTranscriptResponse)
    }).catch(function(err) {
        console.error("Failed to process slackWebHook", err);
        callback(err, null);
    })
      
    } 
  });
  

  
}

// TODO : 여기 따서 함ㅜ 고보 ttp://labs.brandi.co.kr/2019/01/30/kwakjs.html
function sendSlackMessage(transcript) {
  const payload = JSON.stringify(
    //   {
    //     text: `Message sent by ${event.name} (${event.email}):\n ${event.message}`,
    //     user: `test user`,
    //     severity: `test severity`,
    //   }
      {
        text: "Danny Torrence left a 1 star review for your property.",
        blocks: [
        	{
        		"type": "section",
        		"text": {
        			"type": "mrkdwn",
        			"text": "Danny Torrence left the following review for your property:"
        		}
        	},
        	{
        		"type": "section",
        		"block_id": "section567",
        		"text": {
        			"type": "mrkdwn",
        			"text": "<https://example.com|Overlook Hotel> \n :star: \n Doors had too many axe holes, guest in room 237 was far too rowdy, whole place felt stuck in the 1920s."
        		},
        		"accessory": {
        			"type": "image",
        			"image_url": "https://is5-ssl.mzstatic.com/image/thumb/Purple3/v4/d3/72/5c/d3725c8f-c642-5d69-1904-aa36e4297885/source/256x256bb.jpg",
        			"alt_text": "Haunted hotel image"
        		}
        	},
        	{
        		"type": "section",
        		"block_id": "section789",
        		"fields": [
        			{
        				"type": "mrkdwn",
        				"text": "*Average Rating*\n1.0"
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
      }
  );
  
  const options = {
    hostname: "hooks.slack.com",
    method: "POST",
    path: "/services/T03CCRCU5B8/B03CPT4GFH9/pM5irPa6ExlmUjEBHGyCJTG7",
  };
  //https://hooks.slack.com/services/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
  
  return new Promise(function(resolve, reject) {
    https.request(options, res => {
      res.on("data", () => callback(null, "OK"));
    })
    req.on("error", (error) => callback(JSON.stringify(error)));
    req.write(payload);
    req.end();
  })
  
  // const req = https.request(options,
  //     (res) => res.on("data", () => callback(null, "OK")))
  // req.on("error", (error) => callback(JSON.stringify(error)));
  // req.write(payload);
  // req.end();
}

// reference : https://github.com/Nexmo/nexmo-developer/blob/main/_use_cases/en/trancribe-amazon-api.md
function downloadFile(key) {
  console.log(`downloading ${key}`)

  const filePath = `./transcripts/${key}`
  
  const params = {
    Bucket: bucketName,
    Key: '/' + key
  }

  //Fetch or read data from aws s3
  const content = s3.getObject(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else { console.log(data.Body.toString()) } //this will log data to console 
  });
}

// reference :  https://github.com/Nexmo/nexmo-developer/blob/main/_use_cases/en/trancribe-amazon-api.md
function displayResults(transcriptJson) {
  const channels = transcriptJson.results.channel_labels.channels

  channels.forEach((channel) => {
    console.log(`*** Channel: ${channel.channel_label}`)

    let words = ''

    channel.items.forEach((item) => {
      words += item.alternatives[0].content + ' '
    })
    console.log(words)
  })
}


// reference : https://github.com/brianklaas/awsPlaybox/blob/e6e0e83b6e36fe4c6283889b63a3e13907f20230/nodejs/lambda/transcribeTranslateExample/getTranscriptionFile.js

function getTranscript(transcriptFileUri) {
    return new Promise(function(resolve, reject) {
        https.get(transcriptFileUri, res => {
            res.setEncoding("utf8");
            let body = "";
            res.on("data", data => {
                body += data;
                console.log("responseBody : ", body);
            });
            res.on("end", () => {
                body = JSON.parse(body);
                //console.log("responseBody : ", body);
                let transcript = body.results.transcripts[0].transcript;
                console.log("Here's the transcript:\n", transcript);
                resolve(transcript);
                return transcript;
            });
            res.on("error", (err) => {
                console.log("Error getting transcript:\n", err);
                reject(Error(err));
            });
        });
    });
}

function writeTranscriptToS3(transcript,transcriptFileName) {
    return new Promise(function(resolve, reject) {
        console.log("Writing transcript to S3 with the name" + transcriptFileName);
        let filePathOnS3 = 'transcripts/' + transcriptFileName + '.txt';
        var params = {
            Bucket: 'NAME OF YOUR BUCKET WHERE YOU WANT OUTPUT TO GO',
            Key: filePathOnS3,
            Body: transcript
        };
        var putObjectPromise = S3.putObject(params).promise();
        putObjectPromise.then(function(data) {
            console.log('Successfully put transcript file on S3');
            resolve(filePathOnS3);
        }).catch(function(err) {
            console.log("Error putting file on S3:\n", err);
            reject(Error(err));
        });
    });
}

async function putDynamo(callInfo) {
	var params = {
	  TableName: callInfoTable,
	  Item: {
		phoneNumber: callInfo.phoneNumber,
		//caseId: callInfo.caseId,
		category : callInfo.category,
		transactionId: callInfo.transactionId,
		requestRecord: callInfo.record,
		requestTranscript: callInfo.transcript,
		status: callInfo.status
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

async function getDyanmo(callInfo) {
  var params = {
    TableName: callInfoTable,
    Key: { callId: callInfo },
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
        //caseId: callInfo.caseId,
        category : callInfo.category,
        transactionId: callInfo.transactionId,
        requestRecord: callInfo.record,
        requestTranscript: callInfo.transcript,
        callId: callInfo.callId,
        status: callInfo.status
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
