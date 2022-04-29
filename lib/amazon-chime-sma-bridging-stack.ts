//  “Copyright Amazon.com Inc. or its affiliates.”
import * as cdk from "@aws-cdk/core";
import s3 = require("@aws-cdk/aws-s3");
import s3deploy = require("@aws-cdk/aws-s3-deployment");
import { S3EventSource } from '@aws-cdk/aws-lambda-event-sources';
import iam = require("@aws-cdk/aws-iam");
import dynamodb = require("@aws-cdk/aws-dynamodb");
import lambda = require("@aws-cdk/aws-lambda");
import { CustomResource, Duration } from "@aws-cdk/core";
import custom = require("@aws-cdk/custom-resources");
import { DynamoEventSource, SqsDlq } from "@aws-cdk/aws-lambda-event-sources";
import * as sqs from "@aws-cdk/aws-sqs";
import events = require("@aws-cdk/aws-events");
import * as targets from '@aws-cdk/aws-events-targets';

export class SmaBridgingDemo extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const wavFiles = new s3.Bucket(this, "wavFiles", {
      publicReadAccess: false,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const wavFileBucketPolicy = new iam.PolicyStatement({
      principals: [
        new iam.ServicePrincipal("voiceconnector.chime.amazonaws.com"),
      ],
      effect: iam.Effect.ALLOW,
      actions: ["s3:GetObject", "s3:PutObject", "s3:PutObjectAcl"],
      resources: [wavFiles.bucketArn, `${wavFiles.bucketArn}/*`],
      sid: "SIPMediaApplicationRead",
    });

    wavFiles.addToResourcePolicy(wavFileBucketPolicy);

    new s3deploy.BucketDeployment(this, "WavDeploy", {
      sources: [s3deploy.Source.asset("./wav_files")],
      destinationBucket: wavFiles,
      contentType: "audio/wav",
    });

    const callInfoTable = new dynamodb.Table(this, "callInfo", {
      partitionKey: {
        name: "phoneNumber",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      stream: dynamodb.StreamViewType.NEW_IMAGE,
    });

    const smaLambdaRole = new iam.Role(this, "smaLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    // const slackWebhookLambda = new lambda.Function(this, "slackWebhookLambda", {
    //   code: lambda.Code.fromAsset("src", {
    //     exclude: ["**", "!slackWebhook.js"],
    //   }),
    //   handler: "slackWebhook.handler",
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   environment: {
    //     CALLINFO_TABLE_NAME: callInfoTable.tableName,
    //     WAVFILE_BUCKET: wavFiles.bucketName,
    //   },
    //   role: smaLambdaRole,
    //   timeout: Duration.seconds(60),
    // });


    const inboundSMALambda = new lambda.Function(this, "inboundSMALambda", {
      code: lambda.Code.fromAsset("src", { exclude: ["**", "!inboundSMA.js"] }),
      handler: "inboundSMA.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        CALLINFO_TABLE_NAME: callInfoTable.tableName,
        WAVFILE_BUCKET: wavFiles.bucketName,
      },
      role: smaLambdaRole,
      timeout: Duration.seconds(60),
    });

    // const emulatorSMALambda = new lambda.Function(this, "emulatorSMALambda", {
    //   code: lambda.Code.fromAsset("src", {
    //     exclude: ["**", "!emulatorSMA.js"],
    //   }),
    //   handler: "emulatorSMA.handler",
    //   runtime: lambda.Runtime.NODEJS_14_X,
    //   environment: {
    //     CALLINFO_TABLE_NAME: callInfoTable.tableName,
    //     WAVFILE_BUCKET: wavFiles.bucketName,
    //   },
    //   role: smaLambdaRole,
    //   timeout: Duration.seconds(60),
    // });

    const chimeCreateRole = new iam.Role(this, "createChimeLambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      inlinePolicies: {
        ["chimePolicy"]: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              resources: ["*"],
              actions: ["chime:*", "lambda:GetPolicy", "lambda:AddPermission"],
            }),
          ],
        }),
      },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole"
        ),
      ],
    });

    const createSMALambda = new lambda.Function(this, "createSMALambda", {
      code: lambda.Code.fromAsset("src", {
        exclude: ["**", "!createChimeResources.py"],
      }),
      handler: "createChimeResources.on_event",
      runtime: lambda.Runtime.PYTHON_3_8,
      role: chimeCreateRole,
      timeout: Duration.seconds(60),
    });

    ////////////////////////////////////////////////////////////////
    /* Transcription create */
    ////////////////////////////////////////////////////////////////
    const createTranscriptionRole = new iam.Role(this, "createTranscriptionRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      // inlinePolicies: {
      //   ["chimePolicy"]: new iam.PolicyDocument({
      //     statements: [
      //       new iam.PolicyStatement({
      //         resources: ["*"],
      //         actions: ["chime:*", "polly:*"],
      //       }),
      //     ],
      //   }),
      // },
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSLambdaBasicExecutionRole"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonS3FullAccess"),
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonTranscribeFullAccess"), 
        iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonDynamoDBFullAccess"), 
      ],
    });

    const createTranscriptionLambda = new lambda.Function(this, "createTranscription", {
      code: lambda.Code.fromAsset("src", { exclude: ["**", "!createTranscription.py"] }),
      handler: "createTranscription.lambda_handler",
      runtime: lambda.Runtime.PYTHON_3_8,
      role: createTranscriptionRole,
      timeout: cdk.Duration.seconds(60),
      environment: {
        WAVFILE_BUCKET: wavFiles.bucketName,
        CALLINFO_TABLE_NAME: callInfoTable.tableName,
      },
    });

    wavFiles.grantReadWrite(createTranscriptionLambda);

    createTranscriptionLambda.addEventSource(new S3EventSource(wavFiles, {
      events: [ s3.EventType.OBJECT_CREATED ],
      filters: [ { suffix: 'wav' } ], // optional
    }));

     ////////////////////////////////////////////////////////////////
    /* Slack Webhook */
    ////////////////////////////////////////////////////////////////

    const slackWebhookLambda = new lambda.Function(this, "slackWebhook", {
      code: lambda.Code.fromAsset("src", { exclude: ["**", "!slackWebhook.js"] }),
      handler: "slackWebhook.handler",
      runtime: lambda.Runtime.NODEJS_14_X,
      role: createTranscriptionRole,
      timeout: cdk.Duration.seconds(60),
      environment: {
        WAVFILE_BUCKET: wavFiles.bucketName,
        CALLINFO_TABLE_NAME: callInfoTable.tableName,
      },
    });

    wavFiles.grantReadWrite(slackWebhookLambda);

    // slackWebhookLambda.addEventSource(new S3EventSource(wavFiles, {
    //   events: [ s3.EventType.OBJECT_CREATED ],
    //   filters: [ { suffix: 'json' } ], // optional
    // }));

    //https://docs.aws.amazon.com/cdk/api/v1/docs/aws-events-readme.html
    //https://github.com/aws-samples/amazon-chime-media-capture-pipeline-demo/blob/main/lib/media-capture-demo.ts
    const processTranscribeRule = new events.Rule(this, "processTranscribeRule", {
      eventPattern: {
        "source": ["aws.transcribe"],
        //"detail-type": ["Transcribe Job State Change"],
        "detail": {
          "TranscriptionJobStatus": ["COMPLETED"]
        }
      },
    });
    
    //processTranscribeRule.addTarget(new targets.LambdaFunction(slackWebhookLambda))
    processTranscribeRule.addTarget(new targets.LambdaFunction(slackWebhookLambda));
    //processTranscribeRule.addTarget(new targets.LambdaFunction(slackWebhookLambda));
    // // const createWavRole = new iam.Role(this, "createWavRole", {
    // //   assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
    // //   inlinePolicies: {
    // //     ["chimePolicy"]: new iam.PolicyDocument({
    // //       statements: [
    // //         new iam.PolicyStatement({
    // //           resources: ["*"],
    // //           actions: ["chime:*", "polly:*"],
    // //         }),
    // //       ],
    // //     }),
    // //   },
    // //   managedPolicies: [
    // //     iam.ManagedPolicy.fromAwsManagedPolicyName(
    // //       "service-role/AWSLambdaBasicExecutionRole"
    // //     ),
    // //   ],
    // // });

    // const createWavLambda = new lambda.Function(this, "createWav", {
    //   code: lambda.Code.fromAsset("src", { exclude: ["**", "!createWav.py"] }),
    //   handler: "createWav.lambda_handler",
    //   runtime: lambda.Runtime.PYTHON_3_8,
    //   role: createWavRole,
    //   timeout: cdk.Duration.seconds(60),
    //   environment: {
    //     WAVFILE_BUCKET: wavFiles.bucketName,
    //   },
    // });

    // wavFiles.grantReadWrite(createWavLambda);

    // createWavLambda.addEventSource(
    //   new DynamoEventSource(callInfoTable, {
    //     startingPosition: lambda.StartingPosition.LATEST,
    //     batchSize: 5,
    //     bisectBatchOnError: true,
    //     retryAttempts: 10,
    //   })
    // );

    const chimeProvider = new custom.Provider(this, "chimeProvider", {
      onEventHandler: createSMALambda,
    });

    const inboundSMA = new CustomResource(this, "inboundSMA", {
      serviceToken: chimeProvider.serviceToken,
      properties: {
        lambdaArn: inboundSMALambda.functionArn,
        region: this.region,
        smaName: this.stackName + "-inbound",
        ruleName: this.stackName + "-inbound",
        createSMA: true,
        smaID: "",
        phoneNumberRequired: true,
      },
    });

    const inboundPhoneNumber = inboundSMA.getAttString("phoneNumber");
    new cdk.CfnOutput(this, "inboundPhoneNumber", {
      value: inboundPhoneNumber,
    });

    // const salesEmulatorSMA = new CustomResource(this, "salesEmulatorSMA", {
    //   serviceToken: chimeProvider.serviceToken,
    //   properties: {
    //     lambdaArn: emulatorSMALambda.functionArn,
    //     region: this.region,
    //     smaName: this.stackName + "-emulator",
    //     ruleName: this.stackName + "-sales",
    //     createSMA: true,
    //     smaID: "",
    //     phoneNumberRequired: true,
    //   },
    // });

    // const emulatorSMAId = salesEmulatorSMA.getAttString("smaID");
    // const salesPhoneNumber = salesEmulatorSMA.getAttString("phoneNumber");

    // new cdk.CfnOutput(this, "salesPhoneNumber", { value: salesPhoneNumber });

    // const supportEmulatorSMA = new CustomResource(this, "supportEmulatorSMA", {
    //   serviceToken: chimeProvider.serviceToken,
    //   properties: {
    //     lambdaArn: emulatorSMALambda.functionArn,
    //     region: this.region,
    //     smaName: this.stackName + "-emulator",
    //     ruleName: this.stackName + "-support",
    //     createSMA: false,
    //     smaID: emulatorSMAId,
    //     phoneNumberRequired: true,
    //   },
    // });

    // const supportPhoneNumber = supportEmulatorSMA.getAttString("phoneNumber");
    // new cdk.CfnOutput(this, "supportPhoneNumber", {
    //   value: supportPhoneNumber,
    // });

    // inboundSMALambda.addEnvironment("SALES_PHONE_NUMBER", salesPhoneNumber);
    // inboundSMALambda.addEnvironment("SUPPORT_PHONE_NUMBER", supportPhoneNumber);

    //callInfoTable.grantFullAccess(emulatorSMALambda);
    callInfoTable.grantFullAccess(createTranscriptionLambda);
    callInfoTable.grantFullAccess(inboundSMALambda);
    callInfoTable.grantFullAccess(slackWebhookLambda);

  }
}
