var mongoose = require('mongoose');
var groupSchema = new mongoose.Schema({
    group_id: Number,
    groupName: String,
    groupImage: String,
    groupAdmin: Number,
    groupNumber: Number,
    groupMembers:[{
        memberId: Number,
        status: String,
        memName: String,
        memimage: String
    }]
});
module.exports = mongoose.model('groups', groupSchema);