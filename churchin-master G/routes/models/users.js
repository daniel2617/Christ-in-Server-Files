var mongoose = require('mongoose');
var bcrypt = require('bcrypt');
var userSchema = new mongoose.Schema({
    user_id:{type:Number,require:true},
    email:{type:String,require:true},
    fullname: String,
    password: {type:String,require:true},
    profile_pic:{type:String},
    username: String,
    passCode: String,
    status: String,
    phone: String,
    location: String,
    dob: String,
    church: String,
    gender: String,
    pastor: Boolean,
    friends: [{
        name: String,
        friendId: Number,
        image: String,
        status: String,
        date: String,
        time: String
    }],
    chats: [{
        image: String,
        name: String,
        message: String,
        time: String,
        date: String,
        dateMic: Number,
        unreadTexts: Number,
        block: String,
        lastMessNumber: Number,
        group: Boolean,
        read: String,
        fromId: Number,
        file: String
    }],
    groups: [{
        group_id: Number,
        groupName: String,
        groupNumber: Number,
        groupImage: String,
        groupAdmin: Number
    }],
    notes:[{
        text: String,
        dateCreated: String,
        id: Number
    }],
    searches: [{
        fullname: String,
        user_id: Number,
        profile_pic: String
    }],
    events:[{
        startDate: String,
        startTime: String,
        stopDate: String,
        stopTime: String,
        eventTitle: String,
        eventLocation: String,
        eventCategory: String,
        unique: Number,
        eventImage: String,
        peopleInterested: []
    }]
});
userSchema.methods.generatHarsh = function (password) {
    return bcrypt.hashSync(password, bcrypt.genSaltSync(9));
};
userSchema.methods.validPassword =function (password) {
    return bcrypt.compareSync(password,this.password);
};
module.exports = mongoose.model('users', userSchema);