
Template.messagePage.currentMessage = function()
  {
    var messageId = Session.get("curMessage");
    if (messageId == null)
      {
      DisplayError("Bad Message Id");
      SetPage("main");
      return "";
      }
    var dbLine = Messages.findOne({id: messageId},{});
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
