#Create an s3 bucket with the command below after configuing the CLI
import boto3
import uuid
#Create low level clients for s3 and Transcribe
s3  = boto3.client('s3')
transcribe = boto3.client('transcribe')

def lambda_handler(event, context):
    print(event)
    #parse out the bucket & file name from the event handler
    for record in event['Records']:
        file_bucket = record['s3']['bucket']['name']
        file_name = record['s3']['object']['key']
        #object_url = 'https://s3.amazonaws.com/{0}/{1}'.format(file_bucket, file_name)
        object_url = 's3://{0}/{1}'.format(file_bucket, file_name)
        out_key = file_name.replace('wav','json')
        print('file_bucket : ' + file_bucket)
        print('file_name : ' + file_name)
        print('object_url :' + object_url)
        print('out_key : ' + out_key)
        response = transcribe.start_transcription_job(
            TranscriptionJobName=file_name[:-4],
            LanguageCode='en-US',
            MediaFormat='wav',
            OutputBucketName=file_bucket,
            OutputKey=out_key,
            Media={
                'MediaFileUri': object_url
            })
        
        print(response)