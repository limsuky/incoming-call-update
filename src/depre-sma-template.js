const wavFileBucket = process.env['WAVFILE_BUCKET'];
const wavFileKey = process.env['WAVFILE_KEY'];

exports.lambdaHandler = async (event, context) => {
  console.log('Lambda is invoked with calldetails:' + JSON.stringify(event));
  let actions;

  switch (event.InvocationEventType) {
    case 'NEW_INBOUND_CALL':
      console.log('NEW_INBOUND_CALL');

      // actions = stepOneActions(event);

      // actions = stepTwoActions(event);

      // actions = stepThreeActions(event);

      actions = stepFourActions(event);

      break;

    case 'HANGUP':
      console.log('HANGUP');
      const hangupId = event.CallDetails.Participants.filter(
        ({ Status }) => Status === 'Connected',
      )?.[0]?.CallId;
      if (hangupId) {
        hangupAction.Parameters.CallId = hangupId;
        actions = [hangupAction];
      }
      break;

    case 'ACTION_SUCCESSFUL':
      console.log('ACTION_SUCCESSFUL');
      switch (event.ActionData.Type) {
        case 'SpeakAndGetDigits':
          console.log('SpeakAndGetDigits Success');
          var receivedDigits = event.ActionData.ReceivedDigits;
          console.log(`Received Digits: ${receivedDigits}`);
          if (receivedDigits === '1') {
            actions = stepOneActions(event);
          } else if (receivedDigits === '2') {
            actions = stepTwoActions(event);
          } else if (receivedDigits === '3') {
            actions = stepThreeActions(event);
          } else {
            actions = [hangupAction];
          }

          break;
      }
      break;
  }

  const response = {
    SchemaVersion: '1.0',
    Actions: actions,
  };

  console.log('Sending response:' + JSON.stringify(response));

  return response;
};

const pauseAction = {
  Type: 'Pause',
  Parameters: {
    DurationInMilliseconds: '1000',
  },
};

const hangupAction = {
  // https://docs.aws.amazon.com/chime/latest/dg/hangup.html
  Type: 'Hangup',
  Parameters: {
    CallId: '', //optional
    // ParticipantTag: '', // optional - Allowed values – LEG-A or LEG-B
    SipResponseCode: '0', //optional - Allowed values – 480–Unavailable; 486–Busy; 0–Normal Termination
  },
};

const playAudioAction = {
  // https://docs.aws.amazon.com/chime/latest/dg/play-audio.html
  Type: 'PlayAudio',
  Parameters: {
    CallId: '', // optional if ParticipantTag present
    // ParticipantTag: '', //optional if CallId present - Allowed values – LEG-A or LEG-B. -  Ignored if CallId specified
    // PlaybackTerminators: [], //optional - Allowed values – An array of the following values; “0”, ”1”, ”2”, ”3”, ”4”, ”5”, ”6”, ”7”, ”8”, ”9”, ”#”, ”*”
    // Repeat: '', //optional - Allowed values – An integer greater than zero
    AudioSource: {
      Type: 'S3', //required - Allowed values – S3
      BucketName: '', //required - Allowed values – A valid S3 bucket for which Amazon Chime has access to the s3:GetObject action
      Key: '', //required - Allowed values – A valid audio file
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
      // Prefix: '', //optional - Allowed values – A valid prefix name
    },
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
      TextType: 'ssml', // optional
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

function stepOneActions(event) {
  speakAction.Parameters.Text =
    '<speak>Hello!  You are calling from <say-as interpret-as="telephone">' +
    event.CallDetails.Participants[0].From +
    '</say-as>. Thanks for calling!  Goodbye!</speak>';
  hangupAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  return [pauseAction, speakAction, stepFourActions(event), hangupAction];
}

function stepTwoActions(event) {
  console.log('Setting Step Two Actions');
  speakAction.Parameters.Text =
    '<speak>Please record a message.  Press # to end.</speak>';
  recordAudioAction.Parameters.RecordingDestination.BucketName = wavFileBucket;
  recordAudioAction.Parameters.CallId =
    event.CallDetails.Participants[0].CallId;
  hangupAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  return [speakAction, recordAudioAction, hangupAction];
}

function stepThreeActions(event) {
  console.log('Setting Step Three Actions');
  playAudioAction.Parameters.AudioSource.BucketName = wavFileBucket;
  playAudioAction.Parameters.AudioSource.Key = wavFileKey;
  playAudioAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  hangupAction.Parameters.CallId = event.CallDetails.Participants[0].CallId;
  return [playAudioAction, hangupAction];
}

function stepFourActions(event) {
  console.log('Setting Step Four Actions');
  speakAndGetDigitsActions.Parameters.SpeechParameters.Text =
   '<speak>Hello!  You are calling from <say-as interpret-as="telephone">' +
   event.CallDetails.Participants[0].From +
   '</say-as>.! <break> For techinical support, press 1. For sales support, press 2. For other inquireis, plress 3</speak>'
    //'For techinical support, press 1. For sales support, press 2. For other inquireis, plress 3';
  speakAndGetDigitsActions.Parameters.CallId =
    event.CallDetails.Participants[0].CallId;
  return [speakAndGetDigitsActions];
}
