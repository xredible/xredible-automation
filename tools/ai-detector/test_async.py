"""Async behavior under CPU work, client disconnects, errors and result retention."""
import threading
import time
import unittest

from fastapi.testclient import TestClient
from app import create_app
from jobs import Jobs
from test_service import WordScorer, KEY, HEADERS


def wait_result(client, job):
    for _ in range(100):
        r = client.get('/result/' + job, headers=HEADERS)
        if r.status_code != 202:
            return r
        time.sleep(0.01)
    raise AssertionError('Test job did not finish')


class AsyncTests(unittest.TestCase):
    def test_post_returns_before_cpu_and_poll_is_authenticated(self):
        entered, release = threading.Event(), threading.Event()
        class Blocking(WordScorer):
            def probability(self, window):
                entered.set()
                release.wait(2)
                return 0.75
        with TestClient(create_app(Blocking, key=KEY)) as c:
            try:
                r=c.post('/detect', headers=HEADERS, json={'text':'x'*200})
                self.assertEqual(r.status_code,202)
                job=r.json()['job_id']
                self.assertTrue(entered.wait(1))
                self.assertEqual(c.get('/result/'+job).status_code,401)
                self.assertEqual(c.get('/result/'+job,headers=HEADERS).status_code,202)
                self.assertEqual(c.post('/detect',headers=HEADERS,json={'text':'x'*200}).status_code,429)
                self.assertEqual(c.get('/health').json()['api_version'],2)
                self.assertTrue(c.get('/health').json()['busy'])
            finally:
                release.set()
            done=wait_result(c,job)
            self.assertEqual(done.json()['status'],'done')
            self.assertEqual(done.json()['result']['ai_percent'],75)
            self.assertEqual(done.headers['cache-control'],'no-store')
            self.assertEqual(c.get('/result/'+job,headers=HEADERS).json(),done.json())

    def test_async_full_document_ranking_matches_sync(self):
        text='human '*40+'\n\n'+'ai '*30+'\n\n'+'human '*10
        with TestClient(create_app(WordScorer,key=KEY)) as c:
            a=c.post('/detect',headers=HEADERS,json={'text':text})
            result=wait_result(c,a.json()['job_id']).json()['result']
            self.assertEqual(result['ai_percent'],37.5)
            self.assertEqual([p['index'] for p in result['paragraphs']],[2,1,3])

    def test_failed_job_never_echoes_text_key_or_partial_score(self):
        class Broken(WordScorer):
            def probability(self, window):
                raise RuntimeError(KEY+' private input')
        with TestClient(create_app(Broken,key=KEY)) as c:
            a=c.post('/detect',headers=HEADERS,json={'text':'x'*200})
            r=wait_result(c,a.json()['job_id'])
            self.assertEqual(r.json()['status'],'error')
            self.assertNotIn(KEY,r.text)
            self.assertNotIn('private input',r.text)
            self.assertNotIn('ai_percent',r.text)
            self.assertFalse(c.get('/health').json()['busy'])

    def test_async_deadline_and_unknown_id(self):
        class Slow(WordScorer):
            def probability(self, window):
                time.sleep(.05)
                return .9
        with TestClient(create_app(Slow,key=KEY,job_budget=.01)) as c:
            a=c.post('/detect',headers=HEADERS,json={'text':'x'*200})
            r=wait_result(c,a.json()['job_id'])
            self.assertEqual(r.json()['status'],'error')
            self.assertNotIn('ai_percent',r.text)
            self.assertEqual(c.get('/result/'+'a'*32,headers=HEADERS).status_code,404)
            self.assertEqual(c.get('/result/bad',headers=HEADERS).status_code,404)

    def test_expiration_and_bounded_retention(self):
        store=Jobs(ttl=.01,limit=3)
        old=store.create();store.finish(old,result={'ai_percent':0})
        time.sleep(.02)
        self.assertIsNone(store.get(old))
        for _ in range(6):
            job=store.create();store.finish(job,result={})
        self.assertLessEqual(len(store.rows),3)
