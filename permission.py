import boto3
import json

S3API = boto3.client("s3", region_name="us-east-1") 
bucket_name = "sha-th-project02"

policy_file = open("public_policy.json", "r")


S3API.put_bucket_policy(
    Bucket = bucket_name,
    Policy = policy_file.read()
)
print ("Setting Permissions - DONE")