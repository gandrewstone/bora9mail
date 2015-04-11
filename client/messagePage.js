
Template.messagePage.currentMessage = function()
  {
    var messageId = Session.get("curMessage");
    if (messageId == null)
      {
      DisplayError("Bad Message Id");
      SetPage("main");
      return "";
      }
    var dbLine = Messages.findOne({owner: globals.username, id: messageId},{});
    if (dbLine == null)
      {
      DisplayError("Message is unavailable");
      SetPage("main");
      return "";
      }

    var ud = Session.get("userData");
    var realkey = dbLine.cipherkey;
    
    for(var i = 0; i<ud.keys.length; i++)
        {
        try
          {
          var realkey = ecc.decrypt(ud.keys[i].sec,dbLine.cipherkey);
          }
        catch(e)
          {
          }
        }

    var trueMessageStr = sjcl.decrypt(realkey,dbLine.message);
    var msg = JSON.parse(trueMessageStr);
    console.log("GOS msg contents:");
    console.log(trueMessageStr);
    //indexOf is not supported for all browsers - will have to write our own fn and attach it to Array.prototype
    if (dbLine.labels.indexOf("unread") == -1)
      console.log ("Message has been read before");
    else
      {
	console.log("First time reading this message");
	Meteor.call("clearBuiltinLabelFromMessages", "unread", [dbLine._id], function(error, result) { if (error) DisplayError("server connection error"); else DisplayWarning("Removed 'Unread' Tag"); } );
      }
    return msg;
  };

Template.messagePage.helpers
  ({
  personDisplay:function(person) { return personDisplay(person); },
  dateDisplay:function(d) { return dateDisplay(d); }
  });

Template.messagePage.events
  ({
  "click #messagePageBack": function(event)
    {
    SetPage("main");
    },
  "click #messagePageReply": function(event)
    {
    Session.set("composing",true);
    }
  });
