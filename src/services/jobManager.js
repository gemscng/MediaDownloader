const jobs = new Map();

module.exports = {
  create(id, mode = 'save') {
    const job = { log: '', done: false, error: null, filename: null, mode };
    jobs.set(id, job);
    return job;
  },
  get(id) {
    return jobs.get(id) || { log: 'Unknown job', done: true, error: 'Not found' };
  },
  jobs,
};
