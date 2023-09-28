const AWS = require('aws-sdk');
AWS.config.update({
    region: 'eu-west-1',
});
const dynamodb = new AWS.DyncamoDB.DocumentClient();
const dynamodbTableName = 'product-inventory';
const healthPath = '/health';
const productPath = '/product';
const productsPath = '/products';

exports.handler = async function(event) {
    console.log('Request event:', event);
    let response;
    switch(true) {
        case event.httpMethod === 'GET' && event.path === healthPath:
            response = buildResponse(200);
            break;

        case event.httpMethod === 'GET' && event.path === productPath:
            response = await getProduct(event.queryStringParameters.productId);
            break;

        case event.httpMethod === 'GET' && event.path === productsPath:
            response = await getProducts();
            break;

        case event.httpMethod === 'POST' && event.path === productPath:
            response = await saveProduct(JSON.parse(event.body));
            break;

        case event.httpMethod === 'PATCH' && event.path === productPath:
            const requestBody = JSON.parse(event.body)
            response = await modifyProduct(
                requestBody.productId,
                requestBody.updateKey,
                requestBody.updateValue,
            );
            break;
        
        case event.httpMethod === 'DELETE' && event.path === productPath:
            response = await deleteProduct(
                JSON.parse(
                    event.body,
                )
                .productId,
            );
            break;
        default:
            response = buildResponse(404, '404, Not Found');
    }
    return response;
}

function buildResponse(statusCode, body) {
    return {
        statusCode: statusCode,
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    }
}

async function scanDynamoRecords(scanParams, itemArray) {
    try {
        const dynamoData = await dynamodb.scan(scanParams).promise();
        itemArray = itemArray.concat(dynamoData.Items);
        if (dynamoData.LastEvaluateKey) {
            scanParams.ExclusiveStartkey = dynamoData.LastEvaluateKey;
            return await scanDynamoRecords(scanParams, itemArray);
        }
        return itemArray;
    } catch (error) {
        console.error('Your error handling here');
    }
}

async function getProduct(id) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'productId': id,
        }
    }
    return await dynamodb.get(params).promise().then(
        (response) => {
            return buildResponse(
                200,
                response.Item,
            )
        }, (error) => {
            console.log('Error handling here', error);
        }
    );
}

async function getProducts() {
    const params = {
        TableName: dynamodbTableName,
    }
    const allProducts = await scanDynamoRecords(params, []);
    const body = {
        products: allProducts,
    }
    return buildResponse(200, body);
}

async function saveProduct(requestBody) {
    const params = {
        TableName: dynamodbTableName,
        Item: requestBody
    }
    return await dynamodb.put(params).promise().then(
        () => {
            const body = {
                Operation: 'SAVE',
                Message: 'SUCCESS',
                Item: requestBody,
            }        
            return buildResponse(200, body);
        }, (error) => {
            console.error('', error);
        }
    )
}

async function modifyProduct(id, key, value) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'productId': id,
        },
        UpdateExpression: `set ${key} = :value`,
        ExpressionAttributeValues: {
            ':value': value,
        },
        ReturnValues: 'UPDATED_NEW',
    }
    return await dynamodb.update(params).promise().then(
        (response) => {
            const body = {
                Operation: 'UPDATE',
                Message: 'SUCCESS',
                Item: response,
            }
            return buildResponse(200, body);
        }, (error) => {
            console.error('here error handling', error);
        }
    )
}

async function deleteProduct(product) {
    const params = {
        TableName: dynamodbTableName,
        Key: {
            'productId': id,
        },
        ReturnValues: 'ALL_OLD',
    }
    return await dynamodb.delete(params).promise().then(
        (response) => {
            const body = {
                Operation: 'DELETE',
                Message: 'SUCCESS',
                Item: response,
            }
            return buildResponse(200, body);
        }
    )
}
