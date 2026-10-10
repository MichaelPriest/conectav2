/** The Conecta website accepts 2-6 distinct answers and a fixed expiry. */
export function validatePollDraft(question:string,options:string[],days:number){
 const text=question.trim();
 const choices=options.map(x=>x.trim());
 if(text.length<5||text.length>250)
  throw new Error('A pergunta deve ter entre 5 e 250 caracteres.');
 if(choices.length<2||choices.length>6||choices.some(x=>!x||x.length>120))
  throw new Error('Informe entre 2 e 6 opções válidas de até 120 caracteres.');
 if(new Set(choices.map(x=>x.toLocaleLowerCase('pt-BR'))).size!==choices.length)
  throw new Error('As opções da enquete devem ser diferentes.');
 if(![1,3,7,14].includes(days))throw new Error('Escolha um prazo válido para a enquete.');
 return {question:text,options:choices,days};
}
