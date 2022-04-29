//const https = require('https');

exports.handler = (event, context, callback) => {
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
//   const req = https.request(options,
//       (res) => res.on("data", () => callback(null, "OK")))
//   req.on("error", (error) => callback(JSON.stringify(error)));
//   req.write(payload);
//   req.end();
}