const decryptData = require("./helpers/crypto");

const data =
  "U2FsdGVkX1/99QoVgBAJhBSjILDXruvVYH8N1wrKmPCmwD5gJ5wYA9Ht9pyMxhq/LZvImiCpesTN5ir6HMHSeCu/e/hu/AA/hJz5hIOtQ1FQS9hVxKDD6x3o0zQRUZxRf9FYHkZZBSg6XDcxuDGv+chwp6X1ODPEVCtFZGLG0UgBP6hZ6nMv+nLC3JcYyJoojc/5iyVD00hAjkNm5DsQcw==";
const secretKey = "thirsty_cat";
const deData = decryptData(data, secretKey);
console.log(deData);
