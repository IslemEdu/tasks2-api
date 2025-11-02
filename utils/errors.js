function sendError(res,statusCode,code,message){
    res.status(statusCode).json({
        error:{
            code,message
        }
    });
}

function invalidInput(res,message ='Invalid input'){
    sendError(res,400,'INVALID_INPUT',message);
}

function notFound(res,message='Resource not found'){
    sendError(res,400,'NOT_FOUND',message)
}

function internalError(res,message='Internal server error'){
    sendError(res,500,'INTERNAL_ERROR',message)
}
module.exports = { invalidInput, notFound, internalError };