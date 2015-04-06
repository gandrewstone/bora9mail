var Future=Npm.require("fibers/future");


Meteor.publish("inbox", function () {
  console.log("userID: " + this.userId);
  if (this.userId == null) return null;
  return Messages.find({ to: this.userId}); 
});

Meteor.publish("labels", function () {
  console.log("userID: " + this.userId);
  if (this.userId == null) return null;
  return Labels.find({ user: this.userId});
});


Meteor.publish("userRecords", function () { return UserRecords.find({}, { fields: {encdata: 0 }}); });

Meteor.startup(function () {
/*
    if (Meteor.users.find().count() === 0){
        var user = Accounts.createUser({
            email: 'admin@bora9mail.com',
            password: 'admin'
        });
        Meteor.users.update({_id: user}, {$set : {account_type: 'admin'}});
    }
*/
});

Meteor.methods({
    checkUsernameAvailability: function (username)
      {
      up = username.toUpperCase();
      console.log("up:" + up + "pn: " + preventedNames[1]);
      if (up.indexOf(".")>=0) return ["no good -- remove the dot", false];
      if (!/^[0-9a-zA-Z_]+$/.test(up)) return ["going to break some computer somewhere", false];
      if (reservedNames.indexOf(up) >= 0) return ["reserved",false];
      if (toosimpleNames.indexOf(up) >=0) return ["too simple", false];
      if (preventedNames.indexOf(up) >=0) return ["mine", false];

      console.log("looking for " + username);
      if (UserRecords.findOne({username: username}) != null) 
        {
        console.log("found!");
        // TODO delay to stop phishing for usernames
        return ["exists", false];
        }
      return ["available", true];
      },
 
  namecoinLookup: function (name) 
    {
    //return "zoo";
    this.unblock();
    var future = new Future();
    namecoin.name_show(name, function (result)
      {
      future.return(result);
      },
      function(error)
      {
      future.return(error);
      });
    return future.wait();
    },

  getTxnsByAddress: function(addr)
    {
    this.unblock();
    return bitcoin.getTxnsByAddress(addr,new Future());
    }, 
  getServerPaymentAddress: function ()
    {
    this.unblock();
    return bitcoin.getNewAddress(new Future());
    },
  usdPerBtc: function ()
    {
/*
    if (bitcoin.usdPerBtc == undefined)
      {
      this.unblock();
      var future = new Future();
      }
*/
    console.log("Client requests UScents per BTC rate: " + bitcoin.usdPerBtc);
    return bitcoin.usdPerBtc;
    },

  test: function (options) {}
  });


