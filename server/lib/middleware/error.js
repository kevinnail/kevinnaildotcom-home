// eslint-disable-next-line no-unused-vars
export default (error, req, res, next) => {
  const status = error.status || 500;

  res.status(status);

  if (process.env.NODE_ENV !== 'test') {
    console.error(error);
  }

  res.send({
    status,
    message: error.message,
    code: error.code,
  });
};
