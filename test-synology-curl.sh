#!/bin/bash
# Test script for the curl-based Synology upload function

# Check if SID is provided
if [ -z "$1" ]; then
  echo "Error: Synology SID is required"
  echo "Usage: ./test-synology-curl.sh <sid>"
  exit 1
fi

# Set environment variables
export USE_SYNOLOGY=true
export SYNOLOGY_SID="$1"
export SYNOLOGY_BASE_URL="https://quickgraveer.synology.me:5001/webapi/entry.cgi"
export SYNOLOGY_BASE_PATH="/data/quick-opslag"

# Create a test PDF file
echo "Creating test PDF file..."
TEST_PDF="/tmp/test-synology-$(date +%s).pdf"
echo "%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
100 700 Td
(Test PDF for Synology upload) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000059 00000 n
0000000118 00000 n
0000000217 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
324
%%EOF" > "$TEST_PDF"

echo "Test PDF created at: $TEST_PDF"

# Test path in Synology
TEST_PATH="test/curl-test-$(date +%s).pdf"
ENCODED_PATH=$(echo "$SYNOLOGY_BASE_PATH/test" | sed 's/ /%20/g' | sed 's/\//%2F/g')

echo "Uploading test file to Synology at path: $TEST_PATH"
echo "Using SID: ${SYNOLOGY_SID:0:10}..."

# Build and execute the curl command
CURL_CMD="curl --location --request GET '$SYNOLOGY_BASE_URL?api=SYNO.FileStation.Upload&version=2&method=upload&path=$ENCODED_PATH&create_parents=true&overwrite=true&_sid=$SYNOLOGY_SID' --form 'file=@\"$TEST_PDF\"'"

echo "Executing curl command:"
echo "$CURL_CMD"
echo ""

# Execute the curl command
eval "$CURL_CMD"
echo ""

# Clean up
rm -f "$TEST_PDF"
echo "Test file cleaned up"
echo "Test complete!"
