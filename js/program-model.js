/* The lesson's deliberately small language: integer assignment and show(). No eval. */
(function(root){
  'use strict';
  var namePattern='[a-z][a-z0-9_]*';
  var atomPattern='(?:-?\\d+|'+namePattern+')';
  var expression=new RegExp('^('+atomPattern+')(?:\\s*([+*\\-])\\s*('+atomPattern+'))?$');
  function traceProgram(source){
    var lines=source.trim().split(/\r?\n/),instructions=[],memory={},output=[],frames=[];
    if(!source.trim())return {error:'Write at least one instruction.',frames:[]};
    if(lines.length>12)return {error:'Keep this experiment to 12 instructions or fewer.',frames:[]};
    for(var i=0;i<lines.length;i++){
      var line=lines[i].trim(),show=line.match(/^show\((.*)\)$/),assign=line.match(new RegExp('^('+namePattern+')\\s*=\\s*(.+)$'));
      if(!line)return {error:'Line '+(i+1)+': remove the blank line so every line is an instruction.',frames:[]};
      var kind=show?'show':assign?'assign':null,body=show?show[1]:assign?assign[2]:'';
      var parts=body.trim().match(expression);
      if(!kind||!parts)return {error:'Line '+(i+1)+': use name = number, name = value + value (or −, *), or show(value).',frames:[]};
      instructions.push({kind:kind,name:assign?assign[1]:null,left:parts[1],op:parts[2]||null,right:parts[3]||null});
    }
    function record(line,phase,caption,change){frames.push({line:line,phase:phase,caption:caption,memory:Object.assign({},memory),output:output.slice(),change:change||null});}
    function value(token){if(/^-?\d+$/.test(token)){var n=Number(token);if(!Number.isSafeInteger(n)||Math.abs(n)>1000000)throw new Error('Use integers between −1,000,000 and 1,000,000.');return n;}if(!Object.prototype.hasOwnProperty.call(memory,token))throw new Error('There is no value named '+token+' yet. Give it a value before reading it.');return memory[token];}
    record(-1,'ready','The notebook and output are empty. Nothing has run yet.');
    for(var at=0;at<instructions.length;at++){
      var ins=instructions[at],a,b,result;
      try{a=value(ins.left);b=ins.op?value(ins.right):null;result=ins.op==='+'?a+b:ins.op==='-'?a-b:ins.op==='*'?a*b:a;if(!Number.isSafeInteger(result)||Math.abs(result)>1000000)throw new Error('The result is outside this small machine’s range (−1,000,000 to 1,000,000).');}
      catch(e){record(at,'error','Stop at line '+(at+1)+'. '+e.message);return {frames:frames,lines:lines,status:'error',error:null};}
      var calculation=ins.op?a+' '+ins.op+' '+b+' = '+result:String(result);
      record(at,'read',ins.op?'Read the current values and work out '+calculation+'. Nothing has been written yet.':'Read '+ins.left+(String(a)!==ins.left?' as '+a:'')+'. Reading alone does not change the notebook.');
      if(ins.kind==='assign'){var old=Object.prototype.hasOwnProperty.call(memory,ins.name)?memory[ins.name]:null;memory[ins.name]=result;record(at,'write','Write '+result+' under '+ins.name+(old===null?'.':', replacing '+old+'.')+' The output is still unchanged.',ins.name);}
      else{output.push(result);record(at,'output','Copy '+result+' to the output. The notebook keeps its value.','output');}
    }
    return {frames:frames,lines:lines,status:'done',error:null};
  }
  if(typeof module!=='undefined'&&module.exports)module.exports=traceProgram;else root.traceProgram=traceProgram;
}(typeof window!=='undefined'?window:this));
