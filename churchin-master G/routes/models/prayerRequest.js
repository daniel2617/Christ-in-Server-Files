var mongoose = require('mongoose');
var paryeSchema = new mongoose.Schema({
    Name: String,
    Gender: String,
    Email: String,
    address: String,
    request: String
});

module.exports = mongoose.model('prayeRequest', paryeSchema);