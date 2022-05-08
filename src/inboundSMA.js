//  “Copyright Amazon.com Inc. or its affiliates.”
const AWS = require("aws-sdk");
const wavFileBucket = process.env["WAVFILE_BUCKET"];
const callInfoTable = process.env["CALLINFO_TABLE_NAME"];
const salesNumber = process.env["SALES_PHONE_NUMBER"];
const supportNumber = process.env["SUPPORT_PHONE_NUMBER"];
var documentClient = new AWS.DynamoDB.DocumentClient();

exports.handler = async (event, context, callback) => {
  console.log("Lambda is invoked with calldetails:" + JSON.stringify(event));
  let actions;

  switch (event.InvocationEventType) {
    case "NEW_INBOUND_CALL":
      console.log("INBOUND");
      actions = await newCall(event);
      break;

    case "ACTION_SUCCESSFUL":
      console.log('EVENT : ACTION_SUCCESSFUL');
      switch (event.ActionData.Type) {
        case 'SpeakAndGetDigits':
          console.log('SpeakAndGetDigits Success');
          var receivedDigits = event.ActionData.ReceivedDigits;
          console.log(`Received Digits: ${receivedDigits}`);
          if (receivedDigits === '1') {
            //actions = await stepRecordActions('technical', event);
            //actions = stepOneActions(event);
            actions = stepRecordActions(event);
          } else if (receivedDigits === '2') {
            //actions = await stepRecordActions('sales', event);
            //actions = stepTwoActions(event);
            actions = stepRecordActions(event);
          } else if (receivedDigits === '3') {
            // actions = await stepRecordActions('others', event);
            actions = stepRecordActions(event);
          } else {
            actions = [hangupAction];
          }
          break;
      }
      break;

    case "HANGUP":
      console.log("HANGUP ACTION");
      if (event.CallDetails.Participants[0].ParticipantTag === "LEG-B") {
        console.log("HANGUP FROM LEG-B");
        hangupAction.Parameters.ParticipantTag = "LEG-A";
        actions = [hangupAction];
        break;
      } else if (event.CallDetails.Participants[0].ParticipantTag === "LEG-A") {
        console.log("HANGUP FROM LEG-A");
        hangupAction.Parameters.ParticipantTag = "LEG-B";
        actions = [hangupAction];
        break;
      } else {
        actions = [];
        break;
      }

    case "CALL_ANSWERED":
      console.log("CALL ANSWERED");
      actions = [];
      break;

    default:
      console.log("FAILED ACTION");
      actions = [hangupAction];
  }

  const response = {
    SchemaVersion: "1.0",
    Actions: actions,
  };

  console.log("Sending response:" + JSON.stringify(response));

  callback(null, response);
};

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* SMA actions*/
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

// New call handler
async function newCall(event, details) {
  console.log('Setting Step Actions');

  speakAction.Parameters.Text =
    '<speak>Hello!  You are calling from <say-as interpret-as="telephone">' +
    event.CallDetails.Participants[0].From +
    '</say-as>.</speak>';

  console.log('Setting Step Four Actions');
  speakAndGetDigitsActions.Parameters.SpeechParameters.Text =
  'For techinical support, press 1. For sales support, press 2. For other inquireis, press 3';
  speakAndGetDigitsActions.Parameters.CallId =
  event.CallDetails.Participants[0].CallId;

  return [pauseAction, speakAction, speakAndGetDigitsActions]; //hangupAction];
}

function stepTwoActions(event) {
  console.log('Setting Step Two Actions');
  speakAction.Parameters.Text =
    '<speak>Please leave a message.  Press # to end.</speak>';
  recordAudioAction.Parameters.RecordingDestination.BucketName = wavFileBucket;
  recordAudioAction.Parameters.CallId =
    event.CallDetails.Participants[0].CallId;
  hangupAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  return [speakAction, recordAudioAction, hangupAction];
}

function stepRecordActions(event) {
  console.log('Setting Step Record Actions');
  console.log('stepRecordActions event : ', event);

  speakAction.Parameters.Text =
    '<speak>Please leave a message. After leave your message, We will contact you soon. <break time="1s"/> Press # to end.</speak>';
  
  const caseId = createCaseId();
  console.log('caseId : ', caseId);

  recordAudioAction.Parameters.RecordingDestination.BucketName = wavFileBucket;
  recordAudioAction.Parameters.RecordingDestination.Prefix = caseId;
  recordAudioAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  hangupAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  
  const recordAsset = 's3://' + wavFileBucket + '/' + caseId + '/' + event.CallDetails.Participants[0].CallId + '-0.wav';
  console.log('recordAsset address : ', recordAsset);
  
  const storeInfo = {
        phoneNumber: event.CallDetails.Participants[0].From,
        caseId: caseId,
        category: event.ActionData.ReceivedDigits,
        transactionId: event.CallDetails.TransactionId,
        requestRecord: recordAsset,
        requestTranscript: "to be updated",
        callId: event.CallDetails.Participants[0].CallId,
        caseStatus: "open"
      };
  console.log("putting in Dynamo: " + JSON.stringify(storeInfo));
  putCaller(storeInfo);
  return [speakAction, recordAudioAction, hangupAction];
}
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* SMA const action objects*/
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
const hangupAction = {
  Type: "Hangup",
  Parameters: {
    SipResponseCode: "0",
    ParticipantTag: "",
  },
};

const playAudioAction = {
  Type: "PlayAudio",
  Parameters: {
    ParticipantTag: "LEG-A",
    AudioSource: {
      Type: "S3",
      BucketName: wavFileBucket,
      Key: "",
    },
  },
};

const playAccountIdAction = {
  Type: "PlayAudio",
  Parameters: {
    ParticipantTag: "LEG-A",
    AudioSource: {
      Type: "S3",
      BucketName: wavFileBucket,
      Key: "",
    },
  },
};

const playAudioAndGetDigitsAction = {
  Type: "PlayAudioAndGetDigits",
  Parameters: {
    MinNumberOfDigits: "",
    MaxNumberOfDigits: "",
    Repeat: 3,
    InBetweenDigitsDurationInMilliseconds: 1000,
    RepeatDurationInMilliseconds: 5000,
    TerminatorDigits: ["#"],
    AudioSource: {
      Type: "S3",
      BucketName: wavFileBucket,
      Key: "",
    },
    FailureAudioSource: {
      Type: "S3",
      BucketName: wavFileBucket,
      Key: "failure.wav",
    },
  },
};

const recordAudioAction = {
  // https://docs.aws.amazon.com/chime/latest/dg/record-audio.html
  Type: 'RecordAudio',
  Parameters: {
    CallId: '', //optional if ParticipantTag present
    // ParticipantTag: '', //optional if CallId present - Allowed values – LEG-A or LEG-B. -  Ignored if CallId specified
    DurationInSeconds: '10', //optional - Allowed values – >0
    // SilenceDurationInSeconds: 3, //optional - Allowed values – [1;1000]
    // SilenceThreshold: 100, //optional - Allowed values – [1;1000]
    RecordingTerminators: ['#'], //required - Allowed values – An array of single digits and symbols from [0123456789#*]
    RecordingDestination: {
      Type: 'S3', //required - Allowed values – S3
      BucketName: '', //required - Allowed values – A valid S3 bucket for which Amazon Chime has access to the s3:GetObject action
      Prefix: '', //optional - Allowed values – A valid prefix name
    },
  },
};

const speakAndGetDigitsActions = {
  // https://docs.aws.amazon.com/chime/latest/dg/speak-and-get-digits.html
  Type: 'SpeakAndGetDigits',
  Parameters: {
    CallId: 'call-id-1', // required
    InputDigitsRegex: '^[123]$', // optional
    SpeechParameters: {
      Text: '', // required
      Engine: 'neural', // optional. Defaults to standard
      LanguageCode: 'en-US', // optional
      TextType: 'text', // optional
      VoiceId: 'Joanna', // optional. Defaults to Joanna
    },
    FailureSpeechParameters: {
      Text: "Sorry, I didn't get that", // required
      Engine: 'neural', // optional. Defaults to the Engine value in SpeechParameters
      LanguageCode: 'en-US', // optional. Defaults to the LanguageCode value in SpeechParameters
      TextType: 'text', // optional. Defaults to the TextType value in SpeechParameters
      VoiceId: 'Joanna', // optional. Defaults to the VoiceId value in SpeechParameters
    },
    MinNumberOfDigits: 1, // optional
    MaxNumberOfDigits: 1, // optional
    TerminatorDigits: ['#'], // optional
    InBetweenDigitsDurationInMilliseconds: 5000, // optional
    Repeat: 3, // optional
    RepeatDurationInMilliseconds: 10000, // required
  },
};

const callRecordAction = {
  Type: "RecordAudio",
  Parameters: {
    // CallId: "call-id-1",
    DurationInSeconds: "10",
    // SilenceDurationInSeconds: 3,
    // SilenceThreshold : 100,
    RecordingTerminators: ["#"],
    RecordingDestination: {
        Type: "S3",
        BucketName: wavFileBucket,
        Prefix: ""
    }
  },
};

const speakAction = {
  // https://docs.aws.amazon.com/chime/latest/dg/speak.html
  Type: 'Speak',
  Parameters: {
    Engine: 'neural', // Required. Either standard or neural
    LanguageCode: 'en-US', // Optional
    Text: '', // Required
    TextType: 'ssml', // Optional. Defaults to text
    VoiceId: 'Joanna', // Required
  },
};


const callAndBridgeAction = {
  Type: "CallAndBridge",
  Parameters: {
    CallTimeoutSeconds: "20", // integer, optional
    CallerIdNumber: "", // required - this phone number must belong to the customer or be the From number of the A Leg
    Endpoints: [
      {
        Uri: "", // required
        BridgeEndpointType: "PSTN", // required
      },
    ],
  },
};

const pauseAction = {
  Type: "Pause",
  Parameters: {
    DurationInMilliseconds: "1000",
  },
};

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

async function updateCaller(callInfo) {
  var params = {
    TableName: callInfoTable,
    Key: {
      phoneNumber: callInfo.phoneNumber,
    },
    UpdateExpression: "set extension = :e",
    ExpressionAttributeValues: {
      ":e": callInfo.extension,
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
        requestRecord: callInfo.requestRecord,
        requestTranscript: callInfo.requestTranscript,
        callId: callInfo.callId,
        caseStatus: callInfo.caseStatus
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

//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////
/* UTILS : case uuid */
//////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////

const createCaseId = () => {
  console.log("in createCaseId")
  let str = ''
  for (let i = 0; i < 6; i++) {
    str += Math.floor(Math.random() * 10)
  }
  return str;
}