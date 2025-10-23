import { Request, Response, NextFunction } from 'express';
import { NotFoundError } from './error.middleware';

export const notFoundHandler = (req: Request, res: Response, next: NextFunction): void => {
  const error = new NotFoundError(`Route ${req.method} ${req.path} not found`);
  next(error);
};