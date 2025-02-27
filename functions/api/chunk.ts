import Env from "../utils/Env";
const {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} = require("@aws-sdk/client-s3");

import { createS3Client } from "../utils/utils";


export default {
    async fetch(
      request,
      env,
    ): Promise<Response> {
      const bucket = env.BUCKET;
  
      const url = new URL(request.url);
      const key = url.pathname.slice(1);
      const action = url.searchParams.get("action");
      const uploadId = url.searchParams.get("uploadId");
      const s3 = createS3Client(env)

      if (action === null) {
        return new Response("Missing action type", { status: 400 });
      }
  
      // Route the request based on the HTTP method and action type
      switch (request.method) {
        case "POST":
          switch (action) {
            case "chunk-create": {
              const params = {
                Bucket: bucket,
                key
              }
              const multipartUpload = await s3.send(new CreateMultipartUploadCommand(params));
              return new Response(
                JSON.stringify(multipartUpload)
              );
            }
            case "chunk-complete": {
              const uploadId = url.searchParams.get("uploadId");
              if (uploadId === null) {
                return new Response("Missing uploadId", { status: 400 });
              }

              interface completeBody {
                parts: R2UploadedPart[];
              }
              const completeBody: completeBody = await request.json();
              if (completeBody === null) {
                return new Response("Missing or incomplete body", {
                  status: 400,
                });
              }
              const params = {
                Bucket: bucket,
                Key: key,
                MultipartUpload: {
                  Parts: completeBody.parts
                },
                UploadId: uploadId
              };
              try {
                const data = await s3.send(new CompleteMultipartUploadCommand(params));
                return new Response(JSON.stringify(data))
              } catch (error) {
                return new Response(error.message, { status: 400 });
              }
            }
            default:
              return new Response(`Unknown action ${action} for POST`, {
                status: 400,
              });
          }
        case "PUT":
          switch (action) {
            case "chunk-upload": {
              
              const partNumberString = url.searchParams.get("partNumber");
              if (partNumberString === null || uploadId === null) {
                return new Response("Missing partNumber or uploadId", {
                  status: 400,
                });
              }
              if (request.body === null) {
                return new Response("Missing request body", { status: 400 });
              }
              
              const partNumber = parseInt(partNumberString);
              
              const params = {
                Bucket: bucket,
                Key: key,
                PartNumber: partNumber,
                UploadId: uploadId,
                Body: request.body
              };
              try {
                const data = await s3.send(new UploadPartCommand(params));
                return new Response(JSON.stringify(data));
              } catch (error: any) {
                return new Response(error.message, { status: 400 });
              }
            }
            default:
              return new Response(`Unknown action ${action} for PUT`, {
                status: 400,
              });
          }
        case "DELETE":
          switch (action) {
            case "chunk-abort": {
              const uploadId = url.searchParams.get("uploadId");
              if (!uploadId) {
                return new Response("Missing uploadId", { status: 400 });
              }
              
              const params = {
                Bucket: bucket,
                Key: key,
                UploadId: uploadId
              }
  
              try {
                const data = await s3.send(new AbortMultipartUploadCommand(params));
                return new Response(JSON.stringify(data))
              } catch (error: any) {
                return new Response(error.message, { status: 400 });
              }
            }
            default:
              return new Response(`Unknown action ${action} for DELETE`, {
                status: 400,
              });
          }
        default:
          return new Response("Method Not Allowed", {
            status: 405,
            headers: { Allow: "PUT, POST, GET, DELETE" },
          });
      }
    },
  } satisfies ExportedHandler<Env>;