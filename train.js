const { spawn } = require('child_process');

console.log('Training model, please stand by...')

try {
  const retrain = spawn('python3', ['./python/train.py']); // Run a python script to retrain the model
  retrain.stdout.on('data', data => {
      console.log(data.toString()); // Log output from python
  });
  retrain.on('close', async code => { // When python finishes
      console.log('Model training finished!')
  });
}
catch (error) {
  console.log('There was an error retraining the model.');
}
