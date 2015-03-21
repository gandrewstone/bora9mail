

// At initialization, let's see if we can talk to the bitcoin server
jsonRpc(BITCOIN_OPTIONS,"getblockcount",[],
  function (result) 
    { 
    console.log("Bitcoin connection OK.  Current block count is: " + JSON.stringify(result)); 
    },
  function (result) 
    {
    if (result.errno == "ECONNREFUSED")
      {
      console.log("ERROR!  Cannot connect to the bitcoin network!");
      }
    else
      {
      console.log("ERROR!  Unknown problem connecting to the bitcoin network: " + JSON.stringify(result)); 
      }
    },null);

// Wrap bitcoin functions in a nice callable manner.
bitcoin = {
  usdPerBtc: "NA",
  usdPerBtcLastLoad: "never",
  xbt2usd: function(bits) // xbt as in "bits" 1000000 per BTC
    {
    return bits*bitcoin.usdPerBtc/100000000;  // 100million not 1 million because usdPerBtc is defined in cents.
    },
  usd2xbt: function(usd) // xbt as in "bits" 1000000 per BTC
    {
    return usd*100000000/bitcoin.usdPerBtc // 100million not 1 million because usdPerBtc is defined in cents. 
    },

  getTxnsByAddress: function(btcAddr,future)
      {
      Meteor.http.call("GET","https://blockchain.info/address/" + btcAddr + "?format=json", function(error, result)
        {
        if (error) { console.log(error); future.return(null); }
        console.log(result.data);
        future.return(result.content);
        //Session.set("txn" + btcAddr, result);
        });
      return future.wait();
      },

  getNewAddress: function(future)
    {
    jsonRpc(BITCOIN_OPTIONS,"getnewaddress",[],
    function (result) 
    { 
    console.log("Bitcoin address: " + JSON.stringify(result));
    future.return(result);
    },
  function (result) 
    {
    if (result.errno == "ECONNREFUSED")
      {
      console.log("ERROR!  Cannot connect to the bitcoin network!");
      }
    else
      {
      console.log("ERROR!  Unknown problem connecting to the bitcoin network: " + JSON.stringify(result)); 
      }
    future.return(null);
    },null);
    return future.wait();
    }

  }

Meteor.http.get("http://winkdex.com/api/v0/price",function(error,result)
  {
  console.log("getting bitcoin price");
  if (result.statusCode == null)  // error
    { 
    console.log("error");
    } 
  else
    {
    console.log("Loaded bitcoin exchange rate " + result.data["price"] + "data " + JSON.stringify(result.data));
    bitcoin.usdPerBtc = result.data["price"];
    bitcoin.usdPerBtcLastLoad = result.data["timestamp"];
    }
  
  });
