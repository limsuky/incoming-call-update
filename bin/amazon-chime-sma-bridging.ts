//  “Copyright Amazon.com Inc. or its affiliates.”
import "source-map-support/register";
import * as cdk from "@aws-cdk/core";
import { SmaSlackIntegDemo } from "../lib/amazon-chime-sma-slack-integ-stack";
// import { ChimeToSlackDemo } from "../lib/chime-to-slack-stack";

const app = new cdk.App();
new SmaSlackIntegDemo(app, "SmaSlackIntegDemo", {});
// new ChimeToSlackDemo(app, "ChimeToSlackDemo", {});

