
const 
crypto = require('crypto'),
config = require('./config'),
NodeCache = require( "node-cache" );
var mycache = new NodeCache();

module.exports.home = async (req,res,next)=>{    
  let token = mycache.get("aTempTokenKey");
  if(token){
    try{
      let paths = await getLinksAsync(token); 
      res.render('gallery', { imgs: paths, layout:false});
    }catch(error){
      return next(new Error("Erro ao obter imagens."));
    }
  }else{
  res.redirect('/login');
  }
}   

module.exports.login = (req,res,next)=>{
    
    let state = crypto.randomBytes(16).toString('hex');

    mycache.set(state, "aTempSessionValue", 600);
     
    let dbxRedirect= config.DBX_OAUTH_DOMAIN 
            + config.DBX_OAUTH_PATH 
            + "?response_type=code&client_id="+config.DBX_APP_KEY
            + "&redirect_uri="+config.OAUTH_REDIRECT_URL 
            + "&state="+state;
    
    res.redirect(dbxRedirect);
}

rp = require('request-promise');

module.exports.oauthredirect = async (req,res,next)=>{

  if(req.query.error_description){
    return next( new Error(req.query.error_description));
  } 

  let state= req.query.state;
  if(!mycache.get(state)){
    return next(new Error("Sessão expirada."));
  } 

  //Exchange code for token
  if(req.query.code ){
  
    let options={
      url: config.DBX_API_DOMAIN + config.DBX_TOKEN_PATH, 
          //build query string
      qs: {'code': req.query.code, 
      'grant_type': 'authorization_code', 
      'client_id': config.DBX_APP_KEY, 
      'client_secret':config.DBX_APP_SECRET,
      'redirect_uri':config.OAUTH_REDIRECT_URL}, 
      method: 'POST',
      json: true }

    try{

      let response = await rp(options);

      mycache.set("aTempTokenKey", response.access_token, 3600);
      res.redirect("/");

    }catch(error){
      return next(new Error('Erro ao obter Token. '+error.message));
    }        
  }
}

async function getLinksAsync(token){

  let result= await listImagePathsAsync(token,'');

  let temporaryLinkResults= await getTemporaryLinksForPathsAsync(token,result.paths);

  var temporaryLinks = temporaryLinkResults.map(function (entry) {
    return entry.link;
  });

  return temporaryLinks;
}

async function listImagePathsAsync(token,path){

  let options={
    url: config.DBX_API_DOMAIN + config.DBX_LIST_FOLDER_PATH, 
    headers:{"Authorization":"Bearer "+token},
    method: 'POST',
    json: true ,
    body: {"path":path}
  }

  try{
    let result = await rp(options);

    let entriesFiltered= result.entries.filter(function(entry){
      return entry.path_lower.search(/\.(gif|jpg|jpeg|tiff|png)$/i) > -1;
    });        

    var paths = entriesFiltered.map(function (entry) {
      return entry.path_lower;
    });

    let response= {};
    response.paths= paths;
    if(result.hasmore) response.cursor= result.cursor;        
    return response;

  }catch(error){
    return next(new Error('Erro ao listar pastas. '+error.message));
  }        
} 

function getTemporaryLinksForPathsAsync(token,paths){

  var promises = [];
  let options={
    url: config.DBX_API_DOMAIN + config.DBX_GET_TEMPORARY_LINK_PATH, 
    headers:{"Authorization":"Bearer "+token},
    method: 'POST',
    json: true
  }

  paths.forEach((path_lower)=>{
    options.body = {"path":path_lower};
    promises.push(rp(options));
  });

  return Promise.all(promises);
}

